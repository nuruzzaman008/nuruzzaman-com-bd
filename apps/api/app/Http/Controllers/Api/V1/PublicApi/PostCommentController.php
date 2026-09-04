<?php

namespace App\Http\Controllers\Api\V1\PublicApi;

use App\Enums\CommentStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\PostCommentResource;
use App\Models\Post;
use App\Models\PostComment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Reader comments and star ratings on an article.
 *
 * Reading is public; writing needs a session. An anonymous comment box on a
 * site that gives engineering advice is a spam magnet, and a name typed into a
 * box is not an identity.
 *
 * Nothing written here appears anywhere until a moderator approves it - not on
 * the page, not in the count, not in the structured data. That is deliberate:
 * an unmoderated comment is a link a spammer chose, published under the owner's
 * domain, and once indexed it becomes the owner's problem.
 */
class PostCommentController extends Controller
{
    public function index(string $slug): AnonymousResourceCollection
    {
        $post = $this->publishedPost($slug);

        $comments = $post->comments()
            ->approved()
            ->orderBy('created_at')
            ->limit(200)
            ->get();

        return PostCommentResource::collection($comments);
    }

    public function store(Request $request, string $slug): JsonResponse
    {
        $post = $this->publishedPost($slug);
        $user = $request->user();

        $validated = $request->validate([
            'body' => ['required', 'string', 'min:3', 'max:2000'],
            'rating' => ['nullable', 'integer', 'min:1', 'max:5'],
            // Hidden from people, tempting to bots. A filled one is dropped
            // silently rather than answered with an error a bot could learn from.
            'website' => ['nullable', 'string', 'max:0'],
        ]);

        $existing = $post->comments()
            ->where('user_id', $user->getKey())
            ->whereIn('status', [CommentStatus::Pending->value, CommentStatus::Approved->value])
            ->exists();

        if ($existing) {
            return response()->json([
                'error' => [
                    'code' => 'already_commented',
                    'message' => 'You have already commented on this article.',
                ],
            ], 409);
        }

        $comment = $post->comments()->create([
            'user_id' => $user->getKey(),
            // Copied now, so a later profile edit does not rewrite an old comment.
            'author_name' => $user->name,
            'body' => $validated['body'],
            'rating' => $validated['rating'] ?? null,
            'status' => CommentStatus::Pending,
            // Hashed, never the address itself: enough to spot a flood, useless
            // to anyone who reads the table.
            'ip_hash' => hash('sha256', (string) $request->ip()),
        ]);

        return (new PostCommentResource($comment))
            ->additional(['meta' => ['moderated' => true]])
            ->response()
            ->setStatusCode(201);
    }

    private function publishedPost(string $slug): Post
    {
        return Post::query()->published()->where('slug', $slug)->firstOrFail();
    }
}
