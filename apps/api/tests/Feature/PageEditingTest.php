<?php

namespace Tests\Feature;

use App\Enums\ContentStatus;
use App\Enums\Role;
use App\Jobs\RevalidateFrontend;
use App\Models\AuditLog;
use App\Models\Page;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

/**
 * Admin → Pages: the owner writes, adds and updates the site's own pages
 * (about, FAQ, policies) and new ones, and a save shows on the live page.
 */
class PageEditingTest extends TestCase
{
    use RefreshDatabase;

    private function page(array $attributes = []): Page
    {
        return Page::create($attributes + [
            'slug' => 'about',
            'title' => 'আমাদের সম্পর্কে',
            'body_markdown' => "## শুরু\n\nপুরনো লেখা।",
            'status' => ContentStatus::Published,
            'template' => 'default',
            'published_at' => now(),
        ]);
    }

    public function test_an_editor_rewrites_a_live_page_and_the_site_refreshes_it(): void
    {
        Queue::fake();
        $editor = $this->userWithRole(Role::Editor);
        $page = $this->page();

        $this->actingAs($editor)->getJson("/api/v1/admin/pages/{$page->id}")
            ->assertOk()
            ->assertJsonPath('data.body_markdown', "## শুরু\n\nপুরনো লেখা।");

        $this->actingAs($editor)->patchJson("/api/v1/admin/pages/{$page->id}", [
            'slug' => 'about',
            'title' => 'আমার সম্পর্কে',
            'body_markdown' => "## শুরু\n\nনতুন লেখা।",
            'seo' => ['meta_title' => 'About Nuruzzaman', 'meta_description' => 'Who I am.', 'noindex' => false],
        ])->assertOk()
            ->assertJsonPath('data.title', 'আমার সম্পর্কে')
            ->assertJsonPath('data.body_markdown', "## শুরু\n\nনতুন লেখা।")
            ->assertJsonPath('data.seo.meta_title', 'About Nuruzzaman');

        $this->getJson('/api/v1/pages/about')->assertOk()->assertJsonPath('data.title', 'আমার সম্পর্কে');

        Queue::assertPushed(RevalidateFrontend::class, fn (RevalidateFrontend $job) => in_array('pages', $job->tags, true)
            && in_array('page:about', $job->tags, true)
            && in_array('sitemap', $job->tags, true));

        $audit = AuditLog::query()->where('action', 'page.updated')->sole();
        $this->assertSame($editor->id, $audit->user_id);
    }

    public function test_moving_a_page_refreshes_its_old_address_too(): void
    {
        Queue::fake();
        $page = $this->page(['slug' => 'site-guide']);

        $this->actingAs($this->userWithRole(Role::Admin))
            ->patchJson("/api/v1/admin/pages/{$page->id}", ['slug' => 'website-guide'])
            ->assertOk();

        Queue::assertPushed(RevalidateFrontend::class, fn (RevalidateFrontend $job) => in_array('page:website-guide', $job->tags, true)
            && in_array('page:site-guide', $job->tags, true));
    }

    public function test_a_new_page_starts_as_an_empty_draft_and_goes_live_when_published(): void
    {
        Queue::fake();
        $admin = $this->userWithRole(Role::Admin);

        $id = $this->actingAs($admin)->postJson('/api/v1/admin/pages', [
            'title' => 'আমাদের সেবা',
            'slug' => 'services',
            'body_markdown' => '',
            'template' => 'default',
        ])->assertCreated()
            ->assertJsonPath('data.status', 'draft')
            ->assertJsonPath('data.body_markdown', '')
            ->json('data.id');

        $this->assertTrue(AuditLog::query()->where('action', 'page.created')->exists());
        $this->getJson('/api/v1/pages/services')->assertNotFound();

        $this->actingAs($admin)->patchJson("/api/v1/admin/pages/{$id}", ['body_markdown' => 'স্ট্রাকচারাল ডিজাইন।'])->assertOk();
        $this->actingAs($admin)->postJson("/api/v1/admin/pages/{$id}/transition", ['status' => 'published'])->assertSuccessful();

        $this->getJson('/api/v1/pages/services')->assertOk()->assertJsonPath('data.title', 'আমাদের সেবা');
    }

    public function test_an_editor_may_save_but_not_publish(): void
    {
        $page = $this->page(['slug' => 'services', 'status' => ContentStatus::Draft, 'published_at' => null]);
        $editor = $this->userWithRole(Role::Editor);

        $this->actingAs($editor)->patchJson("/api/v1/admin/pages/{$page->id}", ['title' => 'সেবা'])->assertOk();
        $this->actingAs($editor)->postJson("/api/v1/admin/pages/{$page->id}/transition", ['status' => 'published'])->assertForbidden();
    }

    public function test_a_page_cannot_take_an_address_the_site_already_uses(): void
    {
        $admin = $this->userWithRole(Role::Admin);

        $this->actingAs($admin)->postJson('/api/v1/admin/pages', [
            'title' => 'Blog', 'slug' => 'blog', 'body_markdown' => '',
        ])->assertUnprocessable()->assertJsonValidationErrors('slug', 'error.fields');

        // The seeded page that already lives at /about keeps its address.
        $about = $this->page();
        $this->actingAs($admin)->patchJson("/api/v1/admin/pages/{$about->id}", ['slug' => 'about', 'title' => 'About'])->assertOk();

        // But another page cannot move onto a reserved one.
        $other = $this->page(['slug' => 'site-guide']);
        $this->actingAs($admin)->patchJson("/api/v1/admin/pages/{$other->id}", ['slug' => 'contact'])
            ->assertUnprocessable()->assertJsonValidationErrors('slug', 'error.fields');
    }

    public function test_an_english_version_needs_its_bengali_page(): void
    {
        $admin = $this->userWithRole(Role::Admin);

        $this->actingAs($admin)->postJson('/api/v1/admin/pages', [
            'title' => 'Services', 'slug' => 'services-en', 'body_markdown' => '',
        ])->assertUnprocessable()->assertJsonValidationErrors('slug', 'error.fields');

        $this->page(['slug' => 'services']);

        $id = $this->actingAs($admin)->postJson('/api/v1/admin/pages', [
            'title' => 'Services', 'slug' => 'services-en', 'body_markdown' => 'Structural design.',
            'seo' => ['meta_title' => 'Services | Nuruzzaman', 'meta_description' => 'What I design.'],
        ])->assertCreated()->json('data.id');
        $this->actingAs($admin)->postJson("/api/v1/admin/pages/{$id}/transition", ['status' => 'published'])->assertSuccessful();

        // The /en page is read with ?locale=en and carries the English document's own SEO.
        $this->app['auth']->forgetGuards();
        $this->getJson('/api/v1/pages/services?locale=en')->assertOk()
            ->assertJsonPath('data.title', 'Services')
            ->assertJsonPath('data.seo.meta_title', 'Services | Nuruzzaman')
            ->assertJsonPath('data.seo.meta_description', 'What I design.');
    }

    public function test_people_without_page_rights_cannot_edit(): void
    {
        $page = $this->page();

        $this->actingAs($this->customer())->patchJson("/api/v1/admin/pages/{$page->id}", ['title' => 'x'])->assertForbidden();
        $this->actingAs($this->userWithRole(Role::Support))->patchJson("/api/v1/admin/pages/{$page->id}", ['title' => 'x'])->assertForbidden();

        $this->assertSame('আমাদের সম্পর্কে', $page->fresh()->title);
    }

    public function test_deleting_a_page_takes_it_off_the_site(): void
    {
        Queue::fake();
        $page = $this->page(['slug' => 'services']);

        $this->actingAs($this->userWithRole(Role::Admin))->deleteJson("/api/v1/admin/pages/{$page->id}")->assertOk();

        $this->getJson('/api/v1/pages/services')->assertNotFound();
        $this->assertTrue(AuditLog::query()->where('action', 'page.deleted')->exists());
        Queue::assertPushed(RevalidateFrontend::class, fn (RevalidateFrontend $job) => in_array('page:services', $job->tags, true));
    }

    public function test_the_sitemap_feed_leaves_out_a_noindex_page(): void
    {
        $this->page(['slug' => 'services']);
        $this->page(['slug' => 'thank-you'])->seo()->create(['noindex' => true]);

        $slugs = collect($this->getJson('/api/v1/site/sitemap')->assertOk()->json('data.pages'))->pluck('slug');

        $this->assertTrue($slugs->contains('services'));
        $this->assertFalse($slugs->contains('thank-you'));
    }
}
