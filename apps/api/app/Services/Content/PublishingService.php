<?php

namespace App\Services\Content;

use App\Enums\ContentStatus;
use App\Exceptions\DomainException;
use App\Jobs\RevalidateFrontend;
use App\Models\Post;
use App\Models\PostRevision;
use App\Models\User;
use App\Support\Audit;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

/**
 * The editorial workflow. Status only changes here, every change writes a
 * publishing event, and a successful publish asks Next.js to drop the cached
 * tags for the affected pages.
 */
class PublishingService
{
    /** @param Model&object{status: ContentStatus} $content */
    public function transition(Model $content, ContentStatus $to, User $actor, ?string $note = null): Model
    {
        /** @var ContentStatus $from */
        $from = $content->status;

        if (! $from->allows($to)) {
            throw DomainException::conflict("Cannot move content from {$from->value} to {$to->value}.");
        }

        if ($to === ContentStatus::Scheduled && blank($content->scheduled_for ?? null)) {
            throw new DomainException('Set a schedule date before scheduling this content.');
        }

        DB::transaction(function () use ($content, $from, $to, $actor, $note) {
            $content->status = $to;

            if ($to === ContentStatus::Published) {
                $content->published_at = $content->published_at ?? now();
                $content->content_updated_at = now();
            }

            $content->save();

            $content->morphMany(\App\Models\PublishingEvent::class, 'publishable')->create([
                'from_status' => $from->value,
                'to_status' => $to->value,
                'actor_id' => $actor->getKey(),
                'note' => $note,
            ]);

            Audit::record('content.status_changed', $content, [
                'from' => $from->value,
                'to' => $to->value,
            ], $actor->getKey());
        });

        RevalidateFrontend::dispatch($this->tagsFor($content));

        return $content->refresh();
    }

    /** Snapshots the current body before an edit so it can be restored later. */
    public function snapshot(Post $post, User $actor, ?string $note = null): PostRevision
    {
        $next = ($post->revisions()->max('revision') ?? 0) + 1;

        return $post->revisions()->create([
            'revision' => $next,
            'title' => $post->title,
            'excerpt' => $post->excerpt,
            'body_markdown' => $post->body_markdown,
            'status' => $post->status->value,
            'note' => $note,
            'created_by' => $actor->getKey(),
        ]);
    }

    public function restore(Post $post, PostRevision $revision, User $actor): Post
    {
        $this->snapshot($post, $actor, 'Auto-snapshot before restoring revision '.$revision->revision);

        $post->update([
            'title' => $revision->title,
            'excerpt' => $revision->excerpt,
            'body_markdown' => $revision->body_markdown,
            'content_updated_at' => now(),
            'updated_by' => $actor->getKey(),
        ]);

        Audit::record('content.revision_restored', $post, ['revision' => $revision->revision], $actor->getKey());

        RevalidateFrontend::dispatch($this->tagsFor($post));

        return $post->refresh();
    }

    /** Publishes anything whose scheduled time has arrived. Run by the scheduler. */
    public function publishDue(): int
    {
        $due = Post::query()
            ->where('status', ContentStatus::Scheduled->value)
            ->whereNotNull('scheduled_for')
            ->where('scheduled_for', '<=', now())
            ->get();

        foreach ($due as $post) {
            $post->update([
                'status' => ContentStatus::Published,
                'published_at' => $post->published_at ?? $post->scheduled_for,
            ]);

            $post->morphMany(\App\Models\PublishingEvent::class, 'publishable')->create([
                'from_status' => ContentStatus::Scheduled->value,
                'to_status' => ContentStatus::Published->value,
                'note' => 'Published by scheduler',
            ]);
        }

        if ($due->isNotEmpty()) {
            RevalidateFrontend::dispatch(['posts', 'sitemap']);
        }

        return $due->count();
    }

    /** @return array<int, string> */
    public function tagsFor(Model $content): array
    {
        return match (true) {
            $content instanceof Post => ['posts', 'post:'.$content->slug, 'sitemap'],
            $content instanceof \App\Models\Page => ['pages', 'page:'.$content->slug, 'sitemap'],
            $content instanceof \App\Models\Course => ['courses', 'course:'.$content->slug, 'sitemap'],
            $content instanceof \App\Models\Product => ['products', 'product:'.$content->slug, 'sitemap'],
            default => ['sitemap'],
        };
    }
}
