<?php

namespace Database\Seeders;

use App\Enums\ContentStatus;
use App\Models\Course;
use Database\Seeders\Support\ContentBundle;
use Illuminate\Database\Seeder;

/**
 * Seeds the three planned courses as drafts with their outline only.
 *
 * They stay unpublished until real lessons exist: CourseController refuses to
 * publish a course with no lessons, and Course::published() hides any course
 * that has none, so an empty placeholder can never be listed or indexed.
 */
class CourseSeeder extends Seeder
{
    public function run(): void
    {
        foreach (ContentBundle::load('seed-courses-bn.md') as $document) {
            $meta = $document['meta'];

            $course = Course::query()->updateOrCreate(
                ['slug' => $meta['slug']],
                [
                    'title' => $meta['title'],
                    'subtitle' => $meta['subtitle'] ?? null,
                    'description_markdown' => $document['body'],
                    'status' => ContentStatus::Draft,
                    'level' => $meta['level'] ?? 'beginner',
                    'language' => $meta['language'] ?? 'Bangla',
                    'outcomes' => ContentBundle::list($meta, 'outcomes'),
                    'audience' => ContentBundle::list($meta, 'audience'),
                    'prerequisites' => ContentBundle::list($meta, 'prerequisites'),
                    'required_software' => ContentBundle::list($meta, 'required_software'),
                    'sequential' => ContentBundle::bool($meta, 'sequential', true),
                    'issues_certificate' => ContentBundle::bool($meta, 'issues_certificate', true),
                    'pass_percentage' => (int) ($meta['pass_percentage'] ?? 70),
                ],
            );

            $sections = ContentBundle::list($meta, 'sections');

            foreach ($sections as $index => $title) {
                $course->sections()->updateOrCreate(
                    ['title' => $title],
                    ['position' => $index],
                );
            }
        }
    }
}
