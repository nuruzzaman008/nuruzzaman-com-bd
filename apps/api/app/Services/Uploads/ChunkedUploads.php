<?php

namespace App\Services\Uploads;

use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Large files sent in parts.
 *
 * The host's PHP refuses any single upload over 2 MB (upload_max_filesize, set
 * by cPanel and not overridable from the application), which rules out every
 * lesson video and most PDFs sent whole. So the browser sends a file in parts
 * well under that limit, and the endpoint the file is meant for names them by
 * upload id; they are joined here into one file that is validated and stored
 * exactly as a direct upload would be.
 *
 * Parts are kept per user, so nobody can attach what someone else sent, and
 * they are removed once used, or after a day if an upload is abandoned.
 */
final class ChunkedUploads
{
    /** Well under the host's 2 MB, leaving room for the form around the part. */
    public const MAX_PART_KB = 1536;

    /**
     * Enough for a 300 MB software installer in 1 MB parts, with room to spare.
     * Each endpoint still sets its own size limit; this only bounds the count.
     */
    public const MAX_PARTS = 320;

    /** What one person may have waiting in unfinished uploads at once. */
    private const MAX_PENDING_BYTES = 1024 * 1024 * 1024;

    private const DISK = 'private';

    private const ROOT = 'upload-chunks';

    public function put(Authenticatable $user, string $uploadId, int $index, UploadedFile $part): void
    {
        $this->forgetStale($user);

        if ($this->pendingBytes($user) + (int) $part->getSize() > self::MAX_PENDING_BYTES) {
            throw ValidationException::withMessages([
                'chunk' => 'Too many unfinished uploads are waiting. Wait a moment and try again.',
            ]);
        }

        Storage::disk(self::DISK)->putFileAs($this->directory($user, $uploadId), $part, $index.'.part');
    }

    /**
     * The file a request carries: uploaded directly as `$field`, or joined from
     * the parts its upload_id names. Null when there is neither.
     */
    public function fileFrom(Request $request, string $field, int $maxKb): ?UploadedFile
    {
        if (! $request->filled('upload_id')) {
            $file = $request->file($field);

            return $file instanceof UploadedFile ? $file : null;
        }

        $validated = $request->validate([
            'upload_id' => ['required', 'uuid'],
            'total' => ['required', 'integer', 'min:1', 'max:'.self::MAX_PARTS],
            'filename' => ['required', 'string', 'max:255'],
        ]);

        return $this->assemble(
            $request->user(),
            strtolower($validated['upload_id']),
            (int) $validated['total'],
            $validated['filename'],
            $maxKb * 1024,
        );
    }

    /** Removes the parts a request named, whether or not they were used. */
    public function forgetFrom(Request $request): void
    {
        $id = $request->input('upload_id');

        if (is_string($id) && Str::isUuid($id) && $request->user() !== null) {
            Storage::disk(self::DISK)->deleteDirectory($this->directory($request->user(), strtolower($id)));
        }
    }

    private function assemble(Authenticatable $user, string $uploadId, int $total, string $name, int $maxBytes): UploadedFile
    {
        $disk = Storage::disk(self::DISK);
        $directory = $this->directory($user, $uploadId);
        $size = 0;

        for ($index = 0; $index < $total; $index++) {
            if (! $disk->exists($directory.'/'.$index.'.part')) {
                throw ValidationException::withMessages([
                    'upload_id' => 'Part '.($index + 1).' of '.$total.' of this file did not arrive. Upload the file again.',
                ]);
            }

            $size += $disk->size($directory.'/'.$index.'.part');
        }

        // Checked before joining, so an oversized file is never written twice.
        if ($size > $maxBytes) {
            throw ValidationException::withMessages([
                'file' => 'The file is larger than '.intdiv($maxBytes, 1024 * 1024).' MB.',
            ]);
        }

        $target = $disk->path($directory.'/assembled');
        $out = fopen($target, 'wb');

        try {
            for ($index = 0; $index < $total; $index++) {
                $in = fopen($disk->path($directory.'/'.$index.'.part'), 'rb');
                stream_copy_to_stream($in, $out);
                fclose($in);
            }
        } finally {
            fclose($out);
        }

        // Test mode: the file was not moved here by PHP's own upload handling,
        // but it is every bit as much an upload, and is validated as one.
        return new UploadedFile($target, $this->safeName($name), null, UPLOAD_ERR_OK, true);
    }

    private function safeName(string $name): string
    {
        $name = basename(str_replace('\\', '/', $name));
        $name = trim(preg_replace('/[\x00-\x1f\x7f]+/u', '', $name) ?? '');

        return $name === '' ? 'file' : mb_substr($name, -255);
    }

    private function directory(Authenticatable $user, string $uploadId): string
    {
        return self::ROOT.'/'.$user->getAuthIdentifier().'/'.$uploadId;
    }

    private function pendingBytes(Authenticatable $user): int
    {
        $disk = Storage::disk(self::DISK);

        return array_sum(array_map(
            fn (string $file) => $disk->size($file),
            $disk->allFiles(self::ROOT.'/'.$user->getAuthIdentifier()),
        ));
    }

    private function forgetStale(Authenticatable $user): void
    {
        $disk = Storage::disk(self::DISK);
        $cutoff = now()->subDay()->getTimestamp();

        foreach ($disk->directories(self::ROOT.'/'.$user->getAuthIdentifier()) as $directory) {
            $times = array_map(fn (string $file) => $disk->lastModified($file), $disk->files($directory));

            if ($times === [] || max($times) < $cutoff) {
                $disk->deleteDirectory($directory);
            }
        }
    }
}
