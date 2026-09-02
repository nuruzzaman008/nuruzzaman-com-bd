<?php

namespace App\Services\Lms;

use App\Enums\EnrollmentStatus;
use App\Jobs\IssueCertificate;
use App\Models\Enrollment;
use App\Models\Lesson;
use App\Models\LessonProgress;
use Illuminate\Support\Facades\DB;

/**
 * Progress is always derived on the server from completed lessons. The client
 * may report the furthest position it reached inside a lesson; it may never
 * report a course completion percentage.
 */
class ProgressService
{
    public function markSeen(Enrollment $enrollment, Lesson $lesson, int $watchedSeconds = 0): LessonProgress
    {
        /** @var LessonProgress $progress */
        $progress = LessonProgress::query()->firstOrNew([
            'enrollment_id' => $enrollment->getKey(),
            'lesson_id' => $lesson->getKey(),
        ]);

        // Monotonic: a reload that reports 0 seconds cannot erase real progress,
        // and a value beyond the lesson duration is clamped.
        $ceiling = $lesson->duration_seconds ?: max($watchedSeconds, $progress->watched_seconds);
        $progress->watched_seconds = min($ceiling, max($progress->watched_seconds, max(0, $watchedSeconds)));
        $progress->last_seen_at = now();
        $progress->save();

        $enrollment->update(['last_lesson_id' => $lesson->getKey()]);

        return $progress;
    }

    /** Idempotent: completing a lesson twice does not change anything. */
    public function complete(Enrollment $enrollment, Lesson $lesson): LessonProgress
    {
        $progress = DB::transaction(function () use ($enrollment, $lesson) {
            /** @var LessonProgress $progress */
            $progress = LessonProgress::query()->firstOrNew([
                'enrollment_id' => $enrollment->getKey(),
                'lesson_id' => $lesson->getKey(),
            ]);

            if (! $progress->is_completed) {
                $progress->is_completed = true;
                $progress->completed_at = now();
            }

            $progress->last_seen_at = now();
            $progress->save();

            $enrollment->update(['last_lesson_id' => $lesson->getKey()]);

            return $progress;
        });

        $this->recalculate($enrollment);

        return $progress;
    }

    public function recalculate(Enrollment $enrollment): Enrollment
    {
        $total = $enrollment->course()->withCount('lessons')->first()?->lessons_count ?? 0;
        $done = $enrollment->progress()->where('is_completed', true)->count();

        $percent = $total > 0 ? (int) floor(($done / $total) * 100) : 0;
        $threshold = (int) config('nb.lms.completion_threshold', 100);
        $justCompleted = $percent >= $threshold && $enrollment->completed_at === null;

        $enrollment->update([
            'progress_percent' => $percent,
            'completed_at' => $justCompleted ? now() : $enrollment->completed_at,
            'status' => $justCompleted ? EnrollmentStatus::Completed : $enrollment->status,
        ]);

        if ($justCompleted && $enrollment->course?->issues_certificate) {
            IssueCertificate::dispatch($enrollment->getKey());
        }

        return $enrollment->refresh();
    }
}
