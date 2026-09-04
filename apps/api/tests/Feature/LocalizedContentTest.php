<?php

namespace Tests\Feature;

use App\Enums\ContentStatus;
use App\Models\Course;
use App\Models\Page;
use App\Models\Post;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * `?locale=en` on the public content endpoints.
 *
 * The rule these tests hold: headings and summaries have an English form,
 * bodies do not, and where no English text exists the Bengali is returned with
 * a flag saying so. Nothing is ever machine translated, and nothing silently
 * comes back in a language the caller did not ask for.
 */
class LocalizedContentTest extends TestCase
{
    use RefreshDatabase;

    /** There is no PageFactory; pages are seeded from content files. */
    private function page(string $slug, string $title, bool $published = true): Page
    {
        return Page::create([
            'slug' => $slug,
            'title' => $title,
            'body_markdown' => 'Body.',
            'status' => $published ? ContentStatus::Published : ContentStatus::Draft,
            'published_at' => $published ? now()->subDay() : null,
        ]);
    }

    /** A course is only reachable once it holds a lesson. */
    private function courseWithLesson(array $attributes): Course
    {
        $course = Course::factory()->published()->create($attributes);
        $section = $course->sections()->create(['title' => 'Module', 'position' => 0]);

        $course->lessons()->create([
            'course_section_id' => $section->id,
            'slug' => 'intro',
            'title' => 'ভূমিকা',
            'title_en' => 'Introduction',
            'type' => 'text',
            'position' => 0,
        ]);

        return $course;
    }

    public function test_a_post_returns_its_english_heading_when_english_is_asked_for(): void
    {
        Post::factory()->published()->create([
            'slug' => 'footing-size',
            'title' => 'ফুটিংয়ের সাইজ',
            'title_en' => 'Footing size',
            'excerpt' => 'বাংলা সারাংশ',
            'excerpt_en' => 'English summary',
        ]);

        $this->getJson('/api/v1/posts/footing-size?locale=en')
            ->assertOk()
            ->assertJsonPath('data.title', 'Footing size')
            ->assertJsonPath('data.excerpt', 'English summary');

        $this->getJson('/api/v1/posts/footing-size')
            ->assertOk()
            ->assertJsonPath('data.title', 'ফুটিংয়ের সাইজ')
            ->assertJsonPath('data.excerpt', 'বাংলা সারাংশ');
    }

    public function test_a_post_body_is_never_reported_as_translated_on_the_english_site(): void
    {
        Post::factory()->published()->create([
            'slug' => 'load-combinations',
            'title_en' => 'Load combinations',
        ]);

        $this->getJson('/api/v1/posts/load-combinations?locale=en')
            ->assertOk()
            ->assertJsonPath('data.body_translated', false);

        $this->getJson('/api/v1/posts/load-combinations')
            ->assertOk()
            ->assertJsonPath('data.body_translated', true);
    }

    public function test_a_post_without_an_english_heading_falls_back_to_the_bengali_one(): void
    {
        Post::factory()->published()->create([
            'slug' => 'not-translated',
            'title' => 'অনুবাদ হয়নি',
            'title_en' => null,
        ]);

        $this->getJson('/api/v1/posts/not-translated?locale=en')
            ->assertOk()
            ->assertJsonPath('data.title', 'অনুবাদ হয়নি');
    }

    public function test_an_seo_override_does_not_put_the_bengali_headline_on_an_english_page(): void
    {
        // The override beats the content's own title, which is the point of it -
        // and is exactly why the Bengali one must not survive into English.
        $post = Post::factory()->published()->create([
            'slug' => 'seo-override',
            'title_en' => 'A clear English heading',
        ]);

        $post->seo()->create([
            'meta_title' => 'বাংলা মেটা টাইটেল',
            'meta_title_en' => 'English meta title',
        ]);

        $this->getJson('/api/v1/posts/seo-override?locale=en')
            ->assertOk()
            ->assertJsonPath('data.seo.meta_title', 'English meta title');

        $this->getJson('/api/v1/posts/seo-override')
            ->assertOk()
            ->assertJsonPath('data.seo.meta_title', 'বাংলা মেটা টাইটেল');
    }

    public function test_an_seo_override_with_no_english_pair_is_null_rather_than_bengali(): void
    {
        $post = Post::factory()->published()->create(['slug' => 'half-set']);
        $post->seo()->create(['meta_title' => 'বাংলা মেটা টাইটেল']);

        // Null, so the page falls back to its own English heading instead of
        // rendering a Bengali tab title on an English page.
        $this->getJson('/api/v1/posts/half-set?locale=en')
            ->assertOk()
            ->assertJsonPath('data.seo.meta_title', null);
    }

    public function test_a_course_returns_its_english_heading_and_subtitle(): void
    {
        $this->courseWithLesson([
            'slug' => 'footing-course',
            'title' => 'ফুটিং কোর্স',
            'title_en' => 'Footing course',
            'subtitle' => 'বাংলা সাবটাইটেল',
            'subtitle_en' => 'English subtitle',
        ]);

        $this->getJson('/api/v1/courses/footing-course?locale=en')
            ->assertOk()
            ->assertJsonPath('data.title', 'Footing course')
            ->assertJsonPath('data.subtitle', 'English subtitle')
            ->assertJsonPath('data.body_translated', false)
            // A lesson title is a heading too, so it follows the language.
            ->assertJsonPath('data.sections.0.lessons.0.title', 'Introduction');
    }

    public function test_an_english_page_is_the_en_document_when_one_exists(): void
    {
        $this->page('about', 'পরিচিতি');
        $this->page('about-en', 'About');

        $this->getJson('/api/v1/pages/about?locale=en')
            ->assertOk()
            ->assertJsonPath('data.slug', 'about-en')
            ->assertJsonPath('data.title', 'About')
            ->assertJsonPath('data.translated', true);
    }

    public function test_an_english_page_falls_back_to_bengali_and_says_so(): void
    {
        $this->page('terms', 'ব্যবহারের শর্তাবলি');

        $this->getJson('/api/v1/pages/terms?locale=en')
            ->assertOk()
            ->assertJsonPath('data.slug', 'terms')
            ->assertJsonPath('data.translated', false);
    }

    public function test_an_unpublished_english_page_does_not_hide_the_bengali_one(): void
    {
        $this->page('resources', 'রিসোর্স');
        // A draft translation must not make the page 404 in English.
        $this->page('resources-en', 'Resources', published: false);

        $this->getJson('/api/v1/pages/resources?locale=en')
            ->assertOk()
            ->assertJsonPath('data.slug', 'resources')
            ->assertJsonPath('data.translated', false);
    }

    public function test_search_matches_both_languages_whatever_locale_is_asked_for(): void
    {
        Post::factory()->published()->create([
            'slug' => 'punching-shear',
            'title' => 'পাঞ্চিং শিয়ার চেক',
            'title_en' => 'Punching shear check',
        ]);

        // An English reader who types a Bengali term still finds the article,
        // which matters on a site whose articles are written in Bengali.
        $this->getJson('/api/v1/search?q='.urlencode('পাঞ্চিং').'&locale=en')
            ->assertOk()
            ->assertJsonPath('data.posts.0.title', 'Punching shear check');

        // And the other way round.
        $this->getJson('/api/v1/search?q=Punching')
            ->assertOk()
            ->assertJsonPath('data.posts.0.title', 'পাঞ্চিং শিয়ার চেক');
    }
}
