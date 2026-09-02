<?php

namespace Database\Seeders;

use App\Enums\ContentStatus;
use App\Models\Author;
use App\Models\Course;
use App\Models\CourseSection;
use App\Models\Lesson;
use App\Models\User;
use App\Support\CourseTracks;
use Database\Seeders\Support\ContentBundle;
use Illuminate\Database\Seeder;

/**
 * Seeds the course catalogue: outlines from seed-courses-bn.md, then the
 * lessons from seed-lessons-bn.md.
 *
 * A course is published only once it actually holds a lesson. That is not
 * cosmetic — CourseController refuses to publish an empty course and
 * Course::published() hides one, so a placeholder can never be listed, indexed
 * or sold.
 */
class CourseSeeder extends Seeder
{
    public function run(): void
    {
        $this->seedCourses();
        $this->seedLessons();
        $this->publishCoursesThatHaveLessons();
        $this->linkPrerequisites();
    }

    private function seedCourses(): void
    {
        $instructor = User::query()->where('email', config('nb.seed.owner_email'))->first();
        $author = Author::query()->where('slug', 'nuruzzaman')->first();

        foreach (ContentBundle::load('seed-courses-bn.md') as $document) {
            $meta = $document['meta'];
            $track = $meta['track'] ?? null;

            $course = Course::query()->updateOrCreate(
                ['slug' => $meta['slug']],
                [
                    'title' => $meta['title'],
                    'subtitle' => $meta['subtitle'] ?? null,
                    'description_markdown' => $document['body'],
                    'level' => $meta['level'] ?? 'beginner',
                    // An unknown track would silently break catalogue browsing,
                    // so it is dropped rather than stored.
                    'track' => CourseTracks::exists($track) ? $track : null,
                    'language' => $meta['language'] ?? 'Bangla',
                    'outcomes' => ContentBundle::list($meta, 'outcomes'),
                    'audience' => ContentBundle::list($meta, 'audience'),
                    'prerequisites' => ContentBundle::list($meta, 'prerequisites'),
                    'required_software' => ContentBundle::list($meta, 'required_software'),
                    'estimated_minutes' => isset($meta['estimated_minutes'])
                        ? (int) $meta['estimated_minutes']
                        : null,
                    'sequential' => ContentBundle::bool($meta, 'sequential', true),
                    'issues_certificate' => ContentBundle::bool($meta, 'issues_certificate', true),
                    'pass_percentage' => (int) ($meta['pass_percentage'] ?? 70),
                ],
            );

            foreach (ContentBundle::list($meta, 'sections') as $index => $title) {
                $course->sections()->updateOrCreate(['title' => $title], ['position' => $index]);
            }

            if ($instructor && $course->instructors()->count() === 0) {
                $course->instructors()->create([
                    'user_id' => $instructor->getKey(),
                    'author_id' => $author?->getKey(),
                    'role' => 'instructor',
                    'position' => 0,
                ]);
            }
        }
    }

    private function seedLessons(): void
    {
        $positions = [];

        foreach (ContentBundle::load('seed-lessons-bn.md') as $document) {
            $meta = $document['meta'];

            $course = Course::query()->where('slug', $meta['course'] ?? '')->first();

            if (! $course) {
                continue;
            }

            /** @var CourseSection $section */
            $section = $course->sections()->firstOrCreate(
                ['title' => $meta['section']],
                ['position' => $course->sections()->count()],
            );

            $key = $course->getKey();
            $positions[$key] = ($positions[$key] ?? -1) + 1;

            Lesson::query()->updateOrCreate(
                ['course_id' => $course->getKey(), 'slug' => $meta['slug']],
                [
                    'course_section_id' => $section->getKey(),
                    'title' => $meta['title'],
                    'type' => $meta['type'] ?? 'text',
                    'body_markdown' => $document['body'],
                    'duration_seconds' => isset($meta['duration_seconds'])
                        ? (int) $meta['duration_seconds']
                        : null,
                    'is_free_preview' => ContentBundle::bool($meta, 'free_preview'),
                    'position' => $positions[$key],
                ],
            );
        }
    }

    private function publishCoursesThatHaveLessons(): void
    {
        Course::query()->whereHas('lessons')->get()->each(function (Course $course) {
            $minutes = (int) ceil($course->lessons()->sum('duration_seconds') / 60);

            $course->forceFill([
                'status' => ContentStatus::Published,
                'published_at' => $course->published_at ?? now(),
                // Derived from the lessons that exist, not typed by hand, so the
                // advertised length always matches the content.
                'estimated_minutes' => $minutes > 0 ? $minutes : $course->estimated_minutes,
            ])->save();
        });
    }

    /**
     * Advisory-only links between courses: they are shown on the course page but
     * do not block enrolment, because nothing here has been sequenced as a
     * mandatory pathway.
     */
    private function linkPrerequisites(): void
    {
        $pairs = [
            'rcc-footing-design-detailing-bangla' => 'structural-load-path-basics-bangla',
            'pile-foundation-design-bangla' => 'rcc-footing-design-detailing-bangla',
            'nb-engineering-tools-complete-workflow' => 'autocad-structural-drawing-productivity',
        ];

        foreach ($pairs as $courseSlug => $requiredSlug) {
            $course = Course::query()->where('slug', $courseSlug)->first();
            $required = Course::query()->where('slug', $requiredSlug)->first();

            if ($course && $required) {
                $course->prerequisiteCourses()->syncWithoutDetaching([
                    $required->getKey() => ['is_blocking' => false, 'position' => 0],
                ]);
            }
        }
    }
}
