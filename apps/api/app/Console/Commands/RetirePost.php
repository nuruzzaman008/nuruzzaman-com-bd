<?php

namespace App\Console\Commands;

use App\Enums\ContentStatus;
use App\Enums\Role as RoleEnum;
use App\Models\Post;
use App\Models\User;
use App\Services\Content\PublishingService;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('content:retire-post {slug : The post to archive} {--note= : Why, for the publishing history}')]
#[Description('Archive a published post through the publishing workflow, recorded against the site owner, so it leaves the blog, search and sitemap.')]
class RetirePost extends Command
{
    public function handle(PublishingService $publishing): int
    {
        $post = Post::query()->where('slug', $this->argument('slug'))->first();

        if (! $post) {
            $this->error('No post with that slug; no changes made.');

            return self::FAILURE;
        }

        if ($post->status === ContentStatus::Archived) {
            $this->info('Already archived; nothing to do.');

            return self::SUCCESS;
        }

        // The change is recorded against a real person - the site's first
        // super admin - as it would be from the dashboard.
        $actor = User::query()
            ->whereHas('roles', fn ($query) => $query->where('name', RoleEnum::SuperAdmin->value))
            ->oldest('id')
            ->first();

        if (! $actor) {
            $this->error('No super admin to record the change against; no changes made.');

            return self::FAILURE;
        }

        $publishing->transition($post, ContentStatus::Archived, $actor, $this->option('note') ?: null);

        $this->info("Archived “{$post->title}” as {$actor->email}.");

        return self::SUCCESS;
    }
}
