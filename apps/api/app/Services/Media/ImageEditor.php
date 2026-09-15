<?php

namespace App\Services\Media;

use App\Exceptions\DomainException;
use App\Models\Media;
use GdImage;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

/**
 * Flips, rotates, crops and scales a library image with GD.
 *
 * The file is rewritten in place, so every page that shows it - as a cover or
 * written into an article's text - shows the edit without being touched. The
 * untouched original is copied aside the first time, so the edit can always
 * be undone.
 *
 * Operations apply in the order the dashboard previews them: flip, rotate
 * clockwise, crop (in the rotated image's pixels), then scale down.
 */
class ImageEditor
{
    public const EDITABLE = ['image/jpeg', 'image/png', 'image/webp'];

    /** Beyond this the host's memory limit is at risk; such a file is resized before upload. */
    private const MAX_PIXELS = 25_000_000;

    public static function canEdit(Media $media): bool
    {
        return $media->disk === 'public' && in_array($media->mime_type, self::EDITABLE, true);
    }

    /**
     * @param  array{rotate?: int, flip_horizontal?: bool, flip_vertical?: bool, crop?: ?array{x: int, y: int, width: int, height: int}, scale_width?: ?int}  $edit
     */
    public function apply(Media $media, array $edit): void
    {
        if (! self::canEdit($media)) {
            throw new DomainException('Only JPEG, PNG and WebP images can be edited.');
        }

        $rotate = ((int) ($edit['rotate'] ?? 0)) % 360;
        $flipHorizontal = (bool) ($edit['flip_horizontal'] ?? false);
        $flipVertical = (bool) ($edit['flip_vertical'] ?? false);
        $crop = $edit['crop'] ?? null;
        $scaleWidth = isset($edit['scale_width']) ? (int) $edit['scale_width'] : null;

        if ($rotate === 0 && ! $flipHorizontal && ! $flipVertical && ! $crop && ! $scaleWidth) {
            throw new DomainException('Nothing to change: flip, rotate, crop or scale the image first.');
        }

        $disk = Storage::disk($media->disk);
        $bytes = (string) $disk->get($media->path);
        $image = $this->open($bytes);

        if ($flipHorizontal || $flipVertical) {
            imageflip($image, match (true) {
                $flipHorizontal && $flipVertical => IMG_FLIP_BOTH,
                $flipHorizontal => IMG_FLIP_HORIZONTAL,
                default => IMG_FLIP_VERTICAL,
            });
        }

        if ($rotate !== 0) {
            // GD turns counter-clockwise; the dashboard speaks clockwise.
            $image = $this->checked(imagerotate($image, 360 - $rotate, imagecolorallocatealpha($image, 0, 0, 0, 127)));
        }

        if ($crop) {
            [$x, $y, $width, $height] = [(int) $crop['x'], (int) $crop['y'], (int) $crop['width'], (int) $crop['height']];

            if ($x < 0 || $y < 0 || $width < 1 || $height < 1 || $x + $width > imagesx($image) || $y + $height > imagesy($image)) {
                throw new DomainException('The crop area goes outside the image.');
            }

            $image = $this->checked(imagecrop($image, ['x' => $x, 'y' => $y, 'width' => $width, 'height' => $height]));
        }

        if ($scaleWidth) {
            if ($scaleWidth > imagesx($image)) {
                throw new DomainException('An image can be made smaller here, not larger.');
            }

            if ($scaleWidth < imagesx($image)) {
                $height = max(1, (int) round(imagesy($image) * $scaleWidth / imagesx($image)));
                $image = $this->checked(imagescale($image, $scaleWidth, $height, IMG_BICUBIC));
            }
        }

        $encoded = $this->encode($image, $media->mime_type);

        if ($media->original_path === null) {
            $backup = 'uploads/originals/'.$media->getKey().'-'.basename($media->path);
            $disk->put($backup, $bytes);
            $media->original_path = $backup;
        }

        $disk->put($media->path, $encoded);
        $this->record($media, $encoded);
    }

    /** Puts the untouched original back and forgets the edit. */
    public function restore(Media $media): void
    {
        if ($media->original_path === null) {
            throw DomainException::conflict('This image has not been edited.');
        }

        $disk = Storage::disk($media->disk);
        $bytes = $disk->get($media->original_path);

        if ($bytes === null) {
            throw DomainException::conflict('The original image is missing, so it cannot be restored.');
        }

        $disk->put($media->path, $bytes);
        $disk->delete($media->original_path);
        $media->original_path = null;

        $this->record($media, $bytes);
    }

    private function open(string $bytes): GdImage
    {
        $size = @getimagesizefromstring($bytes);

        if (! $size) {
            throw new DomainException('The image file could not be read.');
        }

        if ($size[0] * $size[1] > self::MAX_PIXELS) {
            throw new DomainException('This image is too large to edit here. Resize it on your computer and upload it again.');
        }

        // Decoding needs width x height x 4 bytes, more than once while turning.
        @ini_set('memory_limit', '512M');

        $image = @imagecreatefromstring($bytes);

        if (! $image instanceof GdImage) {
            throw new DomainException('The image file could not be read.');
        }

        if (! imageistruecolor($image)) {
            imagepalettetotruecolor($image);
        }

        imagealphablending($image, false);
        imagesavealpha($image, true);

        return $image;
    }

    private function checked(GdImage|false $image): GdImage
    {
        if (! $image instanceof GdImage) {
            throw new RuntimeException('GD could not transform the image.');
        }

        imagealphablending($image, false);
        imagesavealpha($image, true);

        return $image;
    }

    private function encode(GdImage $image, string $mime): string
    {
        ob_start();

        $written = match ($mime) {
            'image/jpeg' => imagejpeg($image, null, 90),
            'image/png' => imagepng($image, null, 6),
            'image/webp' => imagewebp($image, null, 90),
        };

        $bytes = (string) ob_get_clean();

        if (! $written || $bytes === '') {
            throw new RuntimeException('GD could not encode the edited image.');
        }

        return $bytes;
    }

    private function record(Media $media, string $bytes): void
    {
        $size = getimagesizefromstring($bytes) ?: [null, null];

        $media->forceFill([
            'width' => $size[0],
            'height' => $size[1],
            'size_bytes' => strlen($bytes),
            'checksum_sha256' => hash('sha256', $bytes),
            'edited_at' => now(),
        ])->save();
    }
}
