<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\CommentStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\PostCommentResource;
use App\Jobs\RevalidateFrontend;
use App\Models\PostComment;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * The comment moderation queue.
 *
 * Nothing here can write a comment: only a signed-in reader can do that, and
 * what they write stays invisible until it passes through this screen.
 *
 * Every decision is audited. Approving publishes someone else's words under the
 * owner's domain and rejecting removes a reader's contribution; both are worth
 * being able to account for later.
 */
class CommentModerationController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $this->guard($request);

        $validated = $request->validate([
            'status' => ['sometimes', 'string', 'in:'.implode(',', array_column(CommentStatus::cases(), 'value'))],
        ]);

        $comments = PostComment::query()
            ->with(['post:id,slug,title'])
            // No filter means the queue: what is actually waiting on a person.
            ->where('status', $validated['status'] ?? CommentStatus::Pending->value)
            ->latest('id')
            ->paginate(50);

        return PostCommentResource::collection($comments);
    }

    public function moderate(Request $request, PostComment $comment): JsonResponse
    {
        $this->guard($request);

        $validated = $request->validate([
            'status' => ['required', 'string', 'in:'.implode(',', CommentStatus::moderatable())],
        ]);

        $status = CommentStatus::from($validated['status']);
        $approved = $status === CommentStatus::Approved;

        $comment->update([
            'status' => $status,
            'approved_at' => $approved ? now() : null,
            'approved_by' => $approved ? $request->user()->getKey() : null,
        ]);

        Audit::record('post_comment.moderated', $comment, ['status' => $status->value]);

        // The article page is cached; the comment list and the count on it are
        // part of that page, so the cache has to be told.
        $comment->loadMissing('post');

        if ($comment->post) {
            RevalidateFrontend::dispatch(['posts', 'post:'.$comment->post->slug]);
        }

        return response()->json([
            'data' => new PostCommentResource($comment->fresh('post')),
        ]);
    }

    private function guard(Request $request): void
    {
        abort_unless($request->user()->hasPermission('comments.moderate'), 403);
    }
}
