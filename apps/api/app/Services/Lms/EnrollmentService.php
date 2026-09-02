<?php

namespace App\Services\Lms;

use App\Enums\EnrollmentStatus;
use App\Exceptions\DomainException;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Lesson;
use App\Models\OrderItem;
use App\Models\User;
use App\Support\Audit;
use Illuminate\Support\Facades\DB;

class EnrollmentService
{
    public function enroll(User $user, Course $course, ?OrderItem $item = null, string $source = 'purchase'): Enrollment
    {
        $days = $item?->fulfillment_meta['access_duration_days']
            ?? $course->access_duration_days
            ?? config('nb.lms.default_access_days');

        return DB::transaction(function () use ($user, $course, $item, $source, $days) {
            /** @var Enrollment $enrollment */
            $enrollment = Enrollment::query()->firstOrNew([
                'user_id' => $user->getKey(),
                'course_id' => $course->getKey(),
            ]);

            // Re-purchasing after an expiry or a revocation reactivates the same
            // enrolment row so progress and certificates are not lost.
            $enrollment->fill([
                'order_id' => $item?->order_id ?? $enrollment->order_id,
                'order_item_id' => $item?->getKey() ?? $enrollment->order_item_id,
                'status' => EnrollmentStatus::Active,
                'source' => $source,
                'starts_at' => $enrollment->starts_at ?? now(),
                'expires_at' => $days ? now()->addDays((int) $days) : null,
                'revoked_at' => null,
                'revoked_reason' => null,
            ]);
            $enrollment->save();

            Audit::record('enrollment.granted', $enrollment, [
                'course' => $course->slug,
                'source' => $source,
            ], $user->getKey());

            return $enrollment;
        });
    }

    public function revoke(Enrollment $enrollment, string $reason): Enrollment
    {
        $enrollment->update([
            'status' => EnrollmentStatus::Revoked,
            'revoked_at' => now(),
            'revoked_reason' => $reason,
        ]);

        Audit::record('enrollment.revoked', $enrollment, ['reason' => $reason]);

        return $enrollment;
    }

    /**
     * Resolves the enrolment that authorises this user to open this lesson, or
     * fails. Free preview lessons are handled by the caller, not here.
     */
    public function assertAccess(User $user, Lesson $lesson): Enrollment
    {
        /** @var Enrollment|null $enrollment */
        $enrollment = Enrollment::query()
            ->where('user_id', $user->getKey())
            ->where('course_id', $lesson->course_id)
            ->first();

        if (! $enrollment || ! $enrollment->isUsable()) {
            throw DomainException::forbidden('You are not enrolled in this course.');
        }

        if (! $this->isUnlocked($enrollment, $lesson)) {
            throw DomainException::forbidden('This lesson is not unlocked for you yet.');
        }

        return $enrollment;
    }

    /** Applies both the content-drip window and the sequential-progress rule. */
    public function isUnlocked(Enrollment $enrollment, Lesson $lesson): bool
    {
        $course = $enrollment->course()->with('lessons')->first();
        $start = $enrollment->starts_at ?? $enrollment->created_at ?? now();

        $dripDays = $lesson->drip_days ?? $lesson->section?->drip_days;

        if ($dripDays !== null && $start->copy()->addDays((int) $dripDays)->isFuture()) {
            return false;
        }

        if (! $course?->sequential) {
            return true;
        }

        $ordered = $course->lessons->sortBy('position')->values();
        $index = $ordered->search(fn (Lesson $item) => $item->is($lesson));

        if ($index === false || $index === 0) {
            return true;
        }

        $previous = $ordered[$index - 1];

        return $enrollment->progress()
            ->where('lesson_id', $previous->getKey())
            ->where('is_completed', true)
            ->exists();
    }
}
