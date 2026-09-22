<?php

namespace App\Services\Notifications;

use App\Enums\ActivationRequestStatus;
use App\Enums\ContentStatus;
use App\Enums\SupportTicketStatus;
use App\Models\ActivationRequest;
use App\Models\ContactMessage;
use App\Models\Course;
use App\Models\CourseQuestion;
use App\Models\PostComment;
use App\Models\SupportTicket;
use App\Models\User;
use App\Notifications\NotificationPresenter;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

/**
 * The dashboard's message inbox: support tickets, contact form messages,
 * student questions and comments awaiting moderation, read as one list of
 * conversations, Messenger style.
 *
 * Nothing is copied: each conversation is read from its own table, and each
 * kind is only offered to staff who may act on it (the same permissions the
 * ticket, question and comment pages use). Replies go through those pages'
 * own endpoints, so their rules, emails and audit entries still apply.
 */
class ConversationService
{
    public const KINDS = ['ticket', 'contact', 'question', 'comment'];

    private const LIST_SIZE = 40;

    /** @return list<string> */
    public function kindsFor(User $user): array
    {
        return array_values(array_filter([
            $user->hasPermission('support.manage') ? 'ticket' : null,
            $user->hasPermission('support.manage') ? 'contact' : null,
            Gate::forUser($user)->allows('viewAny', Course::class) ? 'question' : null,
            $user->hasPermission('comments.moderate') ? 'comment' : null,
        ]));
    }

    /**
     * The newest conversations, newest activity first.
     *
     * @return list<array<string, mixed>>
     */
    public function list(User $user, ?string $kind, bool $waitingOnly): array
    {
        $kinds = $kind ? array_intersect([$kind], $this->kindsFor($user)) : $this->kindsFor($user);
        $avatars = new AvatarUrls($user);

        $items = collect();
        foreach ($kinds as $one) {
            $items = $items->concat(match ($one) {
                'ticket' => $this->tickets($waitingOnly),
                'contact' => $this->contacts($waitingOnly),
                'question' => $this->questions($waitingOnly),
                'comment' => $this->comments($waitingOnly),
            });
        }

        $items = $items->sortByDesc('at')->take(self::LIST_SIZE)->values();
        $avatars->load($items->pluck('person_id')->filter()->all());

        return $items->map(fn (array $item) => $this->finish($item, $avatars))->all();
    }

    /** How many conversations wait for a reply, per kind the user may see. */
    public function waiting(User $user): array
    {
        $counts = [];
        foreach ($this->kindsFor($user) as $kind) {
            $counts[$kind] = match ($kind) {
                'ticket' => SupportTicket::query()->where('status', SupportTicketStatus::Open->value)->count(),
                'contact' => ContactMessage::query()->whereNull('handled_at')->count(),
                'question' => CourseQuestion::query()->whereNull('answered_at')
                    ->where('status', '!=', ContentStatus::Archived->value)->count(),
                'comment' => PostComment::query()->where('status', 'pending')->count(),
            };
        }

        return $counts;
    }

    /**
     * The "still to do" counts in the bell: the same queues the dashboard
     * pages work through, limited to what this person may act on.
     *
     * @return list<array{key: string, count: int, url: string}>
     */
    public function pending(User $user): array
    {
        $waiting = $this->waiting($user);
        $rows = [];

        if ($user->hasPermission('orders.manage')) {
            $rows[] = ['key' => 'payments', 'count' => DB::table('manual_payment_submissions')->where('status', 'pending')->count(), 'url' => '/dashboard/payments'];
        }
        foreach (['ticket' => 'tickets', 'contact' => 'contacts', 'question' => 'questions', 'comment' => 'comments'] as $kind => $key) {
            if (array_key_exists($kind, $waiting)) {
                $rows[] = ['key' => $key, 'count' => $waiting[$kind], 'url' => '/dashboard/messages?kind='.$kind];
            }
        }
        if ($user->hasPermission('activation.review')) {
            $rows[] = [
                'key' => 'activations',
                'count' => ActivationRequest::query()->whereIn('status', [
                    ActivationRequestStatus::Submitted->value,
                    ActivationRequestStatus::UnderReview->value,
                    ActivationRequestStatus::NeedsInfo->value,
                ])->count(),
                'url' => '/dashboard/activation-requests',
            ];
        }

        return $rows;
    }

    /**
     * One conversation, as chat bubbles, or null when it does not exist or is
     * not this person's to see.
     *
     * @return array<string, mixed>|null
     */
    public function thread(User $user, string $kind, string $key): ?array
    {
        if (! in_array($kind, $this->kindsFor($user), true)) {
            return null;
        }

        $thread = match ($kind) {
            'ticket' => $this->ticketThread($key),
            'contact' => $this->contactThread($key),
            'question' => $this->questionThread($user, $key),
            'comment' => $this->commentThread($key),
            default => null,
        };
        if (! $thread) {
            return null;
        }

        $avatars = new AvatarUrls($user);
        $avatars->load(collect($thread['messages'])->pluck('author_id')->push($thread['person_id'])->filter()->all());

        $thread['messages'] = array_map(function (array $message) use ($avatars) {
            $message['avatar_url'] = $avatars->for($message['author_id'] ?? null);
            unset($message['author_id']);

            return $message;
        }, $thread['messages']);

        return $this->finish($thread, $avatars);
    }

    /** @return Collection<int, array<string, mixed>> */
    private function tickets(bool $waitingOnly): Collection
    {
        return SupportTicket::query()
            ->with(['user:id,name,email', 'messages' => fn ($query) => $query->where('is_internal', false)->reorder()->latest('id')->limit(1)])
            ->withMax('messages as last_message_at', 'created_at')
            ->when($waitingOnly, fn ($query) => $query->where('status', SupportTicketStatus::Open->value))
            ->orderByDesc('last_message_at')
            ->limit(self::LIST_SIZE)
            ->get()
            ->map(function (SupportTicket $ticket) {
                $last = $ticket->messages->first();

                return [
                    'kind' => 'ticket',
                    'key' => $ticket->reference,
                    'title' => $ticket->subject,
                    'subtitle' => $ticket->reference,
                    'status' => $ticket->status->value,
                    'waiting' => $ticket->status === SupportTicketStatus::Open,
                    'person_id' => $ticket->user_id,
                    'person_name' => $ticket->name ?: $ticket->user?->name,
                    'person_email' => $ticket->email ?: $ticket->user?->email,
                    'preview' => $last?->body,
                    'preview_from' => $last?->author_kind === 'staff' ? 'staff' : 'customer',
                    'at' => $this->time($ticket->last_message_at ?? $ticket->created_at),
                ];
            });
    }

    /** @return Collection<int, array<string, mixed>> */
    private function contacts(bool $waitingOnly): Collection
    {
        return ContactMessage::query()
            ->with(['replies' => fn ($query) => $query->reorder()->latest('id')->limit(1)])
            ->withMax('replies as last_reply_at', 'created_at')
            ->when($waitingOnly, fn ($query) => $query->whereNull('handled_at'))
            ->latest('id')
            ->limit(self::LIST_SIZE)
            ->get()
            ->map(function (ContactMessage $message) {
                $last = $message->replies->first();

                return [
                    'kind' => 'contact',
                    'key' => (string) $message->getKey(),
                    'title' => $message->subject,
                    'subtitle' => $message->email,
                    'status' => $message->handled_at ? 'answered' : 'open',
                    'waiting' => $message->handled_at === null,
                    'person_id' => null,
                    'person_name' => $message->name,
                    'person_email' => $message->email,
                    'preview' => $last?->body ?? $message->message,
                    'preview_from' => $last ? 'staff' : 'customer',
                    'at' => $this->time($message->last_reply_at ?? $message->created_at),
                ];
            });
    }

    /** @return Collection<int, array<string, mixed>> */
    private function questions(bool $waitingOnly): Collection
    {
        return CourseQuestion::query()
            ->where('status', '!=', ContentStatus::Archived->value)
            ->with(['user:id,name,email', 'course:id,title,slug', 'replies' => fn ($query) => $query->reorder()->latest('id')->limit(1)])
            ->withMax('replies as last_reply_at', 'created_at')
            ->when($waitingOnly, fn ($query) => $query->whereNull('answered_at'))
            ->latest('id')
            ->limit(self::LIST_SIZE)
            ->get()
            ->map(function (CourseQuestion $question) {
                $last = $question->replies->first();

                return [
                    'kind' => 'question',
                    'key' => (string) $question->getKey(),
                    'title' => $question->title,
                    'subtitle' => $question->course?->title,
                    'status' => $question->answered_at ? 'answered' : 'open',
                    'waiting' => $question->answered_at === null,
                    'person_id' => $question->user_id,
                    'person_name' => $question->user?->name,
                    'person_email' => $question->user?->email,
                    'preview' => $last?->body ?? $question->body,
                    'preview_from' => $last?->from_instructor ? 'staff' : 'customer',
                    'at' => $this->time($question->last_reply_at ?? $question->created_at),
                ];
            });
    }

    /** @return Collection<int, array<string, mixed>> */
    private function comments(bool $waitingOnly): Collection
    {
        return PostComment::query()
            ->with(['user:id,name,email', 'post:id,title,slug'])
            ->when($waitingOnly, fn ($query) => $query->where('status', 'pending'))
            ->latest('id')
            ->limit(self::LIST_SIZE)
            ->get()
            ->map(fn (PostComment $comment) => [
                'kind' => 'comment',
                'key' => (string) $comment->getKey(),
                'title' => $comment->post?->title ?? '',
                'subtitle' => $comment->rating ? str_repeat('★', (int) $comment->rating) : null,
                'status' => $comment->status?->value ?? (string) $comment->status,
                'waiting' => ($comment->status?->value ?? $comment->status) === 'pending',
                'person_id' => $comment->user_id,
                'person_name' => $comment->author_name ?: $comment->user?->name,
                'person_email' => $comment->user?->email,
                'preview' => $comment->body,
                'preview_from' => 'customer',
                'at' => $this->time($comment->created_at),
            ]);
    }

    /** @return array<string, mixed>|null */
    private function ticketThread(string $reference): ?array
    {
        $ticket = SupportTicket::query()
            ->where('reference', $reference)
            ->with(['user:id,name,email', 'messages.author:id,name', 'order:id,number'])
            ->first();
        if (! $ticket) {
            return null;
        }

        return [
            'kind' => 'ticket',
            'key' => $ticket->reference,
            'title' => $ticket->subject,
            'subtitle' => implode(' · ', array_filter([$ticket->reference, $ticket->category, $ticket->order?->number, $ticket->mobile])),
            'status' => $ticket->status->value,
            'waiting' => $ticket->status === SupportTicketStatus::Open,
            'person_id' => $ticket->user_id,
            'person_name' => $ticket->name ?: $ticket->user?->name,
            'person_email' => $ticket->email ?: $ticket->user?->email,
            'at' => $this->time($ticket->created_at),
            'can_reply' => true,
            'actions' => ['internal_note' => true, 'resolve' => $ticket->status !== SupportTicketStatus::Resolved, 'moderate' => false],
            'messages' => $ticket->messages->map(fn ($message) => [
                'id' => 'm'.$message->id,
                'from' => $message->is_internal ? 'note' : ($message->author_kind === 'staff' ? 'staff' : 'customer'),
                'author' => $message->author_kind === 'staff'
                    ? ($message->author?->name ?? 'Support')
                    : ($ticket->name ?: $ticket->user?->name),
                'author_id' => $message->author_id,
                'body' => $message->body,
                'at' => $this->time($message->created_at),
            ])->values()->all(),
        ];
    }

    /** @return array<string, mixed>|null */
    private function contactThread(string $key): ?array
    {
        $message = ctype_digit($key) ? ContactMessage::query()->with('replies.user:id,name')->find((int) $key) : null;
        if (! $message) {
            return null;
        }

        return [
            'kind' => 'contact',
            'key' => (string) $message->getKey(),
            'title' => $message->subject,
            'subtitle' => $message->email,
            'status' => $message->handled_at ? 'answered' : 'open',
            'waiting' => $message->handled_at === null,
            'person_id' => null,
            'person_name' => $message->name,
            'person_email' => $message->email,
            'at' => $this->time($message->created_at),
            'can_reply' => true,
            'actions' => ['internal_note' => false, 'resolve' => false, 'moderate' => false],
            'messages' => collect([[
                'id' => 'c'.$message->getKey(),
                'from' => 'customer',
                'author' => $message->name,
                'author_id' => null,
                'body' => $message->message,
                'at' => $this->time($message->created_at),
            ]])->concat($message->replies->map(fn ($reply) => [
                'id' => 'r'.$reply->id,
                'from' => 'staff',
                'author' => $reply->user?->name ?? 'Support',
                'author_id' => $reply->user_id,
                'body' => $reply->body,
                'at' => $this->time($reply->created_at),
            ]))->values()->all(),
        ];
    }

    /** @return array<string, mixed>|null */
    private function questionThread(User $user, string $key): ?array
    {
        $question = ctype_digit($key)
            ? CourseQuestion::query()->with(['user:id,name,email', 'course', 'lesson:id,title', 'replies.user:id,name'])->find((int) $key)
            : null;
        if (! $question || ($question->status?->value ?? $question->status) === ContentStatus::Archived->value) {
            return null;
        }

        return [
            'kind' => 'question',
            'key' => (string) $question->getKey(),
            'title' => $question->title,
            'subtitle' => implode(' · ', array_filter([$question->course?->title, $question->lesson?->title])),
            'status' => $question->answered_at ? 'answered' : 'open',
            'waiting' => $question->answered_at === null,
            'person_id' => $question->user_id,
            'person_name' => $question->user?->name,
            'person_email' => $question->user?->email,
            'at' => $this->time($question->created_at),
            // Answering needs the right to edit the course (CoursePolicy::update).
            'can_reply' => $question->course !== null && Gate::forUser($user)->allows('update', $question->course),
            'actions' => ['internal_note' => false, 'resolve' => false, 'moderate' => false],
            'messages' => collect([[
                'id' => 'q'.$question->getKey(),
                'from' => 'customer',
                'author' => $question->user?->name,
                'author_id' => $question->user_id,
                'body' => $question->body,
                'at' => $this->time($question->created_at),
            ]])->concat($question->replies->map(fn ($reply) => [
                'id' => 'r'.$reply->id,
                'from' => $reply->from_instructor ? 'staff' : 'customer',
                'author' => $reply->user?->name,
                'author_id' => $reply->user_id,
                'body' => $reply->body,
                'at' => $this->time($reply->created_at),
            ]))->values()->all(),
        ];
    }

    /** @return array<string, mixed>|null */
    private function commentThread(string $key): ?array
    {
        $comment = ctype_digit($key) ? PostComment::query()->with(['user:id,name,email', 'post:id,title,slug'])->find((int) $key) : null;
        if (! $comment) {
            return null;
        }
        $status = $comment->status?->value ?? (string) $comment->status;

        return [
            'kind' => 'comment',
            'key' => (string) $comment->getKey(),
            'title' => $comment->post?->title ?? '',
            'subtitle' => $comment->rating ? str_repeat('★', (int) $comment->rating) : null,
            'status' => $status,
            'waiting' => $status === 'pending',
            'person_id' => $comment->user_id,
            'person_name' => $comment->author_name ?: $comment->user?->name,
            'person_email' => $comment->user?->email,
            'at' => $this->time($comment->created_at),
            // A comment is answered by deciding on it; there is no reply thread.
            'can_reply' => false,
            'actions' => ['internal_note' => false, 'resolve' => false, 'moderate' => true],
            'messages' => [[
                'id' => 'p'.$comment->getKey(),
                'from' => 'customer',
                'author' => $comment->author_name ?: $comment->user?->name,
                'author_id' => $comment->user_id,
                'body' => $comment->body,
                'at' => $this->time($comment->created_at),
            ]],
        ];
    }

    /**
     * @param  array<string, mixed>  $item
     * @return array<string, mixed>
     */
    private function finish(array $item, AvatarUrls $avatars): array
    {
        $item['person'] = [
            'name' => $item['person_name'] ?? null,
            'email' => $item['person_email'] ?? null,
            'avatar_url' => $avatars->for($item['person_id'] ?? null),
        ];
        if (array_key_exists('preview', $item)) {
            $item['preview'] = NotificationPresenter::excerpt($item['preview'] ?? null, 140);
        }
        $item['url'] = '/dashboard/messages?c='.$item['kind'].':'.rawurlencode((string) $item['key']);
        unset($item['person_id'], $item['person_name'], $item['person_email']);

        return $item;
    }

    private function time(mixed $value): ?string
    {
        return $value ? Carbon::parse($value)->toIso8601String() : null;
    }
}
