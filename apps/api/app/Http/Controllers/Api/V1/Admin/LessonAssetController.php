<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Lesson;
use App\Models\LessonAsset;
use App\Services\Uploads\ChunkedUploads;
use App\Support\DocumentLink;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class LessonAssetController extends Controller
{
    /** 100 MB, in the kilobytes Laravel's max rule counts. */
    private const MAX_KB = 102400;

    /**
     * Any file a course might hand out is accepted - PDFs, Word and Excel
     * documents, drawings, calculation files, archives, installers - except the
     * kinds a web server could be talked into running. Files are kept on a
     * private disk and only ever sent back as downloads, so this is a second
     * line of defence rather than the only one.
     */
    private const BLOCKED_EXTENSIONS = [
        'php', 'php3', 'php4', 'php5', 'php7', 'php8', 'phtml', 'pht', 'phps', 'phar',
        'cgi', 'pl', 'asp', 'aspx', 'jsp', 'shtml', 'htaccess', 'htpasswd', 'ini',
    ];

    public function reorder(Request $request, Course $course, Lesson $lesson): JsonResponse
    {
        $this->authorize('update', $course);
        abort_unless($lesson->course_id === $course->id, 404);
        $input = $request->validate(['ids' => ['required', 'array'], 'ids.*' => ['required', 'integer', 'distinct']]);
        DB::transaction(function () use ($lesson, $input) {
            $ids = $lesson->assets()->lockForUpdate()->pluck('id')->all();
            abort_unless(count($ids) === count($input['ids']) && ! array_diff($ids, $input['ids']), 422, 'Provide every file from this lesson exactly once.');
            foreach ($input['ids'] as $position => $id) {
                $lesson->assets()->whereKey($id)->update(['position' => $position]);
            }
        });

        return response()->json(['data' => $lesson->assets()->get()]);
    }

    public function store(Request $request, Course $course, Lesson $lesson, ChunkedUploads $uploads): JsonResponse
    {
        $this->authorize('update', $course);
        abort_unless($lesson->course_id === $course->id, 404);

        try {
            // A file over the host's per-request limit arrives in parts first.
            $file = $uploads->fileFrom($request, 'file', self::MAX_KB);

            $validated = Validator::make(
                ['title' => $request->input('title'), 'file' => $file],
                [
                    'title' => ['nullable', 'string', 'max:200'],
                    'file' => ['required', 'file', 'max:'.self::MAX_KB, $this->notRunnable(...)],
                ],
            )->validate();

            return response()->json(['data' => $this->attach($lesson, $validated['file'], $validated['title'] ?? null)], 201);
        } finally {
            $uploads->forgetFrom($request);
        }
    }

    /**
     * A document linked rather than uploaded - a Google Drive, Dropbox or
     * OneDrive share, or any https:// address. Learners reach it through the
     * same enrolment-checked download route as a stored file.
     */
    public function storeLink(Request $request, Course $course, Lesson $lesson): JsonResponse
    {
        $this->authorize('update', $course);
        abort_unless($lesson->course_id === $course->id, 404);

        $validated = $request->validate([
            'title' => ['nullable', 'string', 'max:200'],
            'url' => ['required', 'string', 'max:'.DocumentLink::MAX_LENGTH, function (string $attribute, mixed $value, Closure $fail) {
                if (! is_string($value) || DocumentLink::normalize($value) === null) {
                    $fail('Enter the full link, starting with https:// - for example a Google Drive or Dropbox share link.');
                }
            }],
        ]);

        $link = DocumentLink::normalize($validated['url']);
        $title = trim((string) ($validated['title'] ?? ''));

        $asset = $lesson->assets()->create([
            'title' => $title !== '' ? $title : self::LINK_TITLES[$link['provider']],
            'disk' => LessonAsset::LINK_DISK,
            'storage_path' => $link['url'],
            'position' => ($lesson->assets()->max('position') ?? -1) + 1,
        ]);

        return response()->json(['data' => $asset], 201);
    }

    private const LINK_TITLES = [
        'google_drive' => 'Google Drive document',
        'dropbox' => 'Dropbox document',
        'onedrive' => 'OneDrive document',
        'other' => 'Linked document',
    ];

    public function destroy(Course $course, Lesson $lesson, LessonAsset $asset): JsonResponse
    {
        $this->authorize('update', $course);
        abort_unless($lesson->course_id === $course->id && $asset->lesson_id === $lesson->id, 404);
        // A link has nothing on disk to remove.
        if (! $asset->isLink()) {
            Storage::disk($asset->disk)->delete($asset->storage_path);
        }
        $asset->delete();

        return response()->json(['message' => 'File deleted.']);
    }

    private function attach(Lesson $lesson, UploadedFile $file, ?string $title): LessonAsset
    {
        $disk = config('nb.downloads.disk', 'private');
        $name = $file->getClientOriginalName();
        $extension = strtolower(pathinfo($name, PATHINFO_EXTENSION));

        // Stored under a random name that keeps the original extension, so a
        // drawing or calculation file downloads as the kind of file it is.
        $stored = Str::random(40).(preg_match('/^[a-z0-9]{1,16}$/', $extension) ? '.'.$extension : '');
        $path = $file->storeAs('lessons/'.$lesson->id, $stored, $disk);

        try {
            return $lesson->assets()->create([
                'title' => $title ?: mb_substr($name, 0, 200),
                'disk' => $disk,
                'storage_path' => $path,
                'mime_type' => mb_substr((string) $file->getMimeType(), 0, 128),
                'size_bytes' => $file->getSize(),
                'checksum_sha256' => hash_file('sha256', $file->getRealPath()),
                'position' => ($lesson->assets()->max('position') ?? -1) + 1,
            ]);
        } catch (\Throwable $error) {
            Storage::disk($disk)->delete($path);
            throw $error;
        }
    }

    private function notRunnable(string $attribute, mixed $value, Closure $fail): void
    {
        $name = $value instanceof UploadedFile ? strtolower($value->getClientOriginalName()) : '';

        // Every extension in the name, not only the last: a server that maps
        // .php anywhere in a name would run "notes.php.pdf".
        if (array_intersect(array_slice(explode('.', $name), 1), self::BLOCKED_EXTENSIONS) !== []) {
            $fail('This kind of file cannot be attached, because a web server could run it. Put it in a ZIP archive instead.');
        }
    }
}
