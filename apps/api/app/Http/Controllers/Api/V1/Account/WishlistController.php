<?php

namespace App\Http\Controllers\Api\V1\Account;

use App\Http\Controllers\Controller;
use App\Http\Resources\CourseResource;
use App\Models\Course;
use App\Models\CourseWishlist;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/** Courses the learner has saved for later. */
class WishlistController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $courses = Course::query()
            ->published()
            ->whereIn('id', CourseWishlist::query()
                ->where('user_id', $request->user()->getKey())
                ->select('course_id'))
            ->with('cover')
            ->withCount('lessons')
            ->orderBy('title')
            ->get();

        return CourseResource::collection($courses);
    }

    public function store(Request $request, string $courseSlug): JsonResponse
    {
        $course = Course::query()->published()->where('slug', $courseSlug)->firstOrFail();

        CourseWishlist::query()->firstOrCreate([
            'user_id' => $request->user()->getKey(),
            'course_id' => $course->getKey(),
        ]);

        return response()->json(['data' => ['saved' => true]], 201);
    }

    public function destroy(Request $request, string $courseSlug): JsonResponse
    {
        $course = Course::query()->where('slug', $courseSlug)->firstOrFail();

        CourseWishlist::query()
            ->where('user_id', $request->user()->getKey())
            ->where('course_id', $course->getKey())
            ->delete();

        return response()->json(status: 204);
    }
}
