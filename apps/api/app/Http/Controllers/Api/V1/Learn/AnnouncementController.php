<?php

namespace App\Http\Controllers\Api\V1\Learn;

use App\Http\Controllers\Controller;
use App\Http\Resources\CourseAnnouncementResource;
use App\Models\Course;
use App\Models\Enrollment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/** Instructor notices, readable only by people enrolled on the course. */
class AnnouncementController extends Controller
{
    public function index(Request $request, string $courseSlug): AnonymousResourceCollection
    {
        $course = Course::query()->where('slug', $courseSlug)->firstOrFail();

        /** @var Enrollment $enrollment */
        $enrollment = Enrollment::query()
            ->where('user_id', $request->user()->getKey())
            ->where('course_id', $course->getKey())
            ->firstOrFail();

        $this->authorize('view', $enrollment);

        $announcements = $course->announcements()
            ->whereNotNull('published_at')
            ->where('published_at', '<=', now())
            ->with('author')
            ->orderByDesc('published_at')
            ->paginate(20);

        return CourseAnnouncementResource::collection($announcements);
    }
}
