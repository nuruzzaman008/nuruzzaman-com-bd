<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\CourseAnnouncementResource;
use App\Models\Course;
use App\Models\CourseAnnouncement;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class CourseAnnouncementController extends Controller
{
    public function index(Course $course): AnonymousResourceCollection
    {
        $this->authorize('view', $course);

        return CourseAnnouncementResource::collection(
            $course->announcements()->with('author')->orderByDesc('created_at')->paginate(50),
        );
    }

    public function store(Request $request, Course $course): CourseAnnouncementResource
    {
        $this->authorize('update', $course);

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'body_markdown' => ['required', 'string', 'max:20000'],
            // Left null to save a draft; set to publish it to the class.
            'published_at' => ['nullable', 'date'],
        ]);

        $announcement = $course->announcements()->create($validated + [
            'user_id' => $request->user()->getKey(),
        ]);

        Audit::record('course.announcement.created', $announcement, [
            'course' => $course->slug,
        ]);

        return new CourseAnnouncementResource($announcement->load('author'));
    }

    public function update(Request $request, Course $course, int $announcementId): CourseAnnouncementResource
    {
        $this->authorize('update', $course);

        $validated = $request->validate([
            'title' => ['sometimes', 'string', 'max:255'],
            'body_markdown' => ['sometimes', 'string', 'max:20000'],
            'published_at' => ['nullable', 'date'],
        ]);

        /** @var CourseAnnouncement $announcement */
        $announcement = $course->announcements()->findOrFail($announcementId);
        $announcement->update($validated);

        return new CourseAnnouncementResource($announcement->fresh()->load('author'));
    }

    public function destroy(Course $course, int $announcementId): JsonResponse
    {
        $this->authorize('update', $course);

        $course->announcements()->findOrFail($announcementId)->delete();

        return response()->json(status: 204);
    }
}
