<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Course;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/** Existing uploads, scoped to the caller and the destination's visibility. */
class UploadLibraryController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $request->validate(['q' => ['nullable', 'string', 'max:100'], 'page' => ['nullable', 'integer', 'min:1']]);
        $rows = $this->files($request)->when($request->filled('q'), fn (Builder $q) => $q->where('name', 'like', '%'.$request->input('q').'%'))
            ->orderByDesc('uploaded_at')->orderBy('source')->orderByDesc('id')->paginate(24);

        return response()->json($rows->through(function ($row) {
            return ['id' => $row->id, 'source' => $row->source, 'name' => $this->filename($row),
                'mime_type' => $row->mime_type, 'size_bytes' => $row->size_bytes,
                'uploaded_at' => $row->uploaded_at,
                // Only a public library file has an address; the editor inserts it as is.
                'url' => $row->source === 'media' && $row->disk === 'public' ? Storage::disk('public')->url($row->path) : null];
        })->toArray())->header('Cache-Control', 'private, no-store');
    }

    public function download(Request $request, string $source, int $id): StreamedResponse
    {
        $row = $this->files($request)->where('source', $source)->where('id', $id)->first();
        abort_unless($row && Storage::disk($row->disk)->exists($row->path), 404);

        return Storage::disk($row->disk)->download($row->path, $this->filename($row), [
            'Cache-Control' => 'private, no-store', 'X-Content-Type-Options' => 'nosniff',
            'Content-Security-Policy' => "default-src 'none'; sandbox",
        ]);
    }

    private function filename(object $row): string
    {
        $name = basename(str_replace('\\', '/', $row->name));
        $extension = pathinfo($row->path, PATHINFO_EXTENSION);
        if ($extension !== '' && pathinfo($name, PATHINFO_EXTENSION) === '') {
            $name .= '.'.$extension;
        }

        return $name;
    }

    private function files(Request $request): Builder
    {
        $input = $request->validate(['scope' => ['required', 'in:public,personal,course'], 'course_id' => ['required_if:scope,course', 'integer']]);
        $user = $request->user();
        $scope = $input['scope'];
        if ($scope !== 'personal') {
            abort_unless($user->hasVerifiedEmail(), 403);
        }
        $media = DB::table('media')->selectRaw("'media' as source, id, original_name as name, mime_type, size_bytes, created_at as uploaded_at, disk, path");

        if ($scope === 'public') {
            abort_unless($user->hasPermission('media.manage'), 403);

            return DB::query()->fromSub($media->where('disk', 'public'), 'files');
        }

        $media->where('uploaded_by', $user->id)->whereIn('disk', ['public', 'private']);
        if ($scope === 'course') {
            $this->authorize('update', Course::findOrFail($input['course_id']));
            $courses = Course::query()->select('id');
            if (! $user->hasPermission('courses.manage')) {
                $courses->whereHas('instructors', fn ($q) => $q->where('user_id', $user->id));
            }
            $assets = DB::table('lesson_assets as a')->join('lessons as l', 'l.id', '=', 'a.lesson_id')
                ->whereIn('l.course_id', $courses)->whereIn('a.disk', ['public', 'private'])
                ->selectRaw("'lesson' as source, a.id, a.title as name, a.mime_type, a.size_bytes, a.created_at as uploaded_at, a.disk, a.storage_path as path");
            $videos = DB::table('lessons')->whereIn('course_id', $courses)->where('video_provider', 'uploaded')->whereNotNull('video_asset_id')
                ->selectRaw("'video' as source, id, title as name, '' as mime_type, 0 as size_bytes, updated_at as uploaded_at, 'private' as disk, video_asset_id as path");

            return DB::query()->fromSub($media->unionAll($assets)->unionAll($videos), 'files');
        }

        $photos = DB::table('profiles')->where('user_id', $user->id)->whereNotNull('avatar_path')
            ->selectRaw("'photo' as source, id, 'Profile photo' as name, '' as mime_type, 0 as size_bytes, updated_at as uploaded_at, 'private' as disk, avatar_path as path");
        $assignments = DB::table('assignment_submissions')->where('user_id', $user->id)->whereNotNull('storage_path')
            ->selectRaw("'assignment' as source, id, original_filename as name, '' as mime_type, 0 as size_bytes, created_at as uploaded_at, disk, storage_path as path");
        $proofs = DB::table('manual_payment_submissions as s')->join('orders as o', 'o.id', '=', 's.order_id')
            ->where('o.user_id', $user->id)->whereNotNull('s.proof_path')
            ->selectRaw("'proof' as source, s.id, CONCAT('Payment proof ', o.number) as name, '' as mime_type, 0 as size_bytes, s.created_at as uploaded_at, 'private' as disk, s.proof_path as path");

        return DB::query()->fromSub($media->unionAll($photos)->unionAll($assignments)->unionAll($proofs), 'files');
    }
}
