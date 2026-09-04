<?php

namespace App\Http\Resources;

use App\Support\CourseTracks;
use App\Support\RequestLocale;
use App\Support\Markdown;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Course */
class CourseResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $reviews = $this->relationLoaded('reviews') ? $this->reviews : collect();

        return [
            // Staff need the primary key to build admin links; the public
            // API is addressed by slug and has no use for it.
            'id' => $this->when(
                (bool) $request->user()?->hasPermission('courses.view'),
                fn () => $this->id,
            ),
            'slug' => $this->slug,
            'title' => RequestLocale::pick($request, $this->title, $this->title_en),
            'subtitle' => RequestLocale::pick($request, $this->subtitle, $this->subtitle_en),
            'description_html' => Markdown::toHtml($this->description_markdown),
            // As with an article: the heading is translated, the description
            // and the outcomes are not, and the page says which it is showing.
            'body_translated' => ! RequestLocale::isEnglish($request),
            'level' => $this->level,
            'track' => $this->track,
            'track_name' => CourseTracks::name($this->track),
            'language' => $this->language,
            'cover_url' => $this->whenLoaded('cover', fn () => $this->cover?->url()),
            'outcomes' => $this->outcomes ?? [],
            'audience' => $this->audience ?? [],
            'prerequisites' => $this->prerequisites ?? [],
            // Courses (as opposed to the free-text notes above) that the
            // learner is expected to have finished first.
            'prerequisite_courses' => $this->whenLoaded('prerequisiteCourses', fn () => $this->prerequisiteCourses->map(fn ($course) => [
                'slug' => $course->slug,
                'title' => RequestLocale::pick($request, $course->title, $course->title_en),
                'is_blocking' => (bool) $course->pivot->is_blocking,
            ])->values()),
            'required_software' => $this->required_software ?? [],
            'estimated_minutes' => $this->estimated_minutes,
            'access_duration_days' => $this->access_duration_days,
            'sequential' => (bool) $this->sequential,
            'issues_certificate' => (bool) $this->issues_certificate,
            'support_policy' => $this->support_policy,
            'refund_policy' => $this->refund_policy,
            'last_reviewed_at' => $this->last_reviewed_at?->toIso8601String(),
            'published_at' => $this->published_at?->toIso8601String(),
            'lesson_count' => $this->whenCounted('lessons'),
            'sections' => CourseSectionResource::collection($this->whenLoaded('sections')),
            'instructors' => $this->whenLoaded('instructors', fn () => $this->instructors->map(fn ($row) => [
                'name' => $row->author?->name ?? $row->user?->name,
                'slug' => $row->author?->slug,
                'credentials' => $row->author?->credentials,
                'role' => $row->role,
            ])->values()),
            // Aggregates are only emitted when there are real reviews, so the
            // JSON-LD on the page can never claim a rating that does not exist.
            'rating' => $reviews->isNotEmpty() ? [
                'average' => round($reviews->avg('rating'), 2),
                'count' => $reviews->count(),
            ] : null,
            'reviews' => CourseReviewResource::collection($this->whenLoaded('reviews')),
            'variants' => ProductVariantResource::collection($this->whenLoaded('purchasableVariants')),
            'seo' => new SeoResource($this->whenLoaded('seo')),
        ];
    }
}
