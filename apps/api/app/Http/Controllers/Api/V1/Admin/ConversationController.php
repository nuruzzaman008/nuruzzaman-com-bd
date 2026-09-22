<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Services\Notifications\ConversationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Dashboard -> Messages, and the chat window the bell opens: tickets,
 * contact messages, student questions and comments as conversations.
 *
 * Read-only. Replies are posted to each kind's own endpoint (support tickets,
 * course questions, comment moderation, contact replies), which keep their
 * own permission checks, emails and audit entries.
 */
class ConversationController extends Controller
{
    public function __construct(private readonly ConversationService $conversations) {}

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'kind' => ['sometimes', Rule::in(ConversationService::KINDS)],
            'filter' => ['sometimes', Rule::in(['all', 'waiting'])],
        ]);
        $user = $request->user();

        return response()
            ->json([
                'data' => $this->conversations->list(
                    $user,
                    $validated['kind'] ?? null,
                    ($validated['filter'] ?? 'all') === 'waiting',
                ),
                'meta' => [
                    'kinds' => $this->conversations->kindsFor($user),
                    'waiting' => (object) $this->conversations->waiting($user),
                ],
            ])
            ->header('Cache-Control', 'private, no-store');
    }

    public function show(Request $request, string $kind, string $key): JsonResponse
    {
        abort_unless(in_array($kind, ConversationService::KINDS, true) && strlen($key) <= 64, 404);

        $thread = $this->conversations->thread($request->user(), $kind, $key);
        abort_unless($thread !== null, 404);

        return response()->json(['data' => $thread])->header('Cache-Control', 'private, no-store');
    }
}
