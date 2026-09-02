<?php

namespace App\Http\Controllers\Api\V1\Learn;

use App\Http\Controllers\Controller;
use App\Models\Assignment;
use App\Models\Enrollment;
use App\Support\Markdown;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AssignmentController extends Controller
{
    public function show(Request $request, int $assignmentId): JsonResponse
    {
        $assignment = Assignment::query()->findOrFail($assignmentId);
        $enrollment = $this->enrollment($request, $assignment);

        $submission = $assignment->submissions()
            ->where('enrollment_id', $enrollment->getKey())
            ->latest('id')
            ->first();

        return response()->json([
            'data' => [
                'id' => $assignment->id,
                'title' => $assignment->title,
                'brief_html' => Markdown::toHtml($assignment->brief_markdown),
                'max_file_size_kb' => $assignment->max_file_size_kb,
                'allowed_mime_types' => $assignment->allowed_mime_types ?? [],
                'submission' => $submission ? [
                    'id' => $submission->id,
                    'status' => $submission->status,
                    'score_percent' => $submission->score_percent,
                    'feedback' => $submission->feedback,
                    'original_filename' => $submission->original_filename,
                    'submitted_at' => $submission->submitted_at?->toIso8601String(),
                    'reviewed_at' => $submission->reviewed_at?->toIso8601String(),
                ] : null,
            ],
        ]);
    }

    /**
     * Uploads are validated on MIME type, extension and size, and are stored on
     * the private disk under a generated name - never the client filename.
     */
    public function submit(Request $request, int $assignmentId): JsonResponse
    {
        $assignment = Assignment::query()->findOrFail($assignmentId);
        $enrollment = $this->enrollment($request, $assignment);

        $allowed = $assignment->allowed_mime_types ?: ['application/pdf', 'image/png', 'image/jpeg', 'application/zip'];

        $validated = $request->validate([
            'notes' => ['nullable', 'string', 'max:2000'],
            'file' => [
                'nullable',
                'file',
                'max:'.$assignment->max_file_size_kb,
                Rule::when(true, ['mimetypes:'.implode(',', $allowed)]),
            ],
        ]);

        $path = null;
        $originalName = null;

        if ($request->hasFile('file')) {
            $file = $request->file('file');
            $originalName = mb_substr($file->getClientOriginalName(), 0, 255);
            $path = $file->store(
                'assignments/'.$assignment->getKey().'/'.$enrollment->getKey(),
                config('nb.downloads.disk'),
            );
        }

        $submission = $assignment->submissions()->create([
            'enrollment_id' => $enrollment->getKey(),
            'user_id' => $request->user()->getKey(),
            'notes' => $validated['notes'] ?? null,
            'disk' => $path ? config('nb.downloads.disk') : null,
            'storage_path' => $path,
            'original_filename' => $originalName,
            'status' => 'submitted',
            'submitted_at' => now(),
        ]);

        return response()->json([
            'data' => [
                'id' => $submission->id,
                'status' => $submission->status,
                'submitted_at' => $submission->submitted_at->toIso8601String(),
            ],
        ], 201);
    }

    private function enrollment(Request $request, Assignment $assignment): Enrollment
    {
        /** @var Enrollment $enrollment */
        $enrollment = Enrollment::query()
            ->where('user_id', $request->user()->getKey())
            ->where('course_id', $assignment->course_id)
            ->firstOrFail();

        $this->authorize('learn', $enrollment);

        return $enrollment;
    }
}
