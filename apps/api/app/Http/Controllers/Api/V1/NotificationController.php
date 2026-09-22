<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Notifications\NotificationPresenter;
use App\Notifications\NotificationType;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Validation\Rule;

/**
 * The signed-in person's own notifications: the bell and the notification page.
 *
 * Served twice: under /admin/notifications for staff, where RequireStaffMfa
 * demands a verified second step (staff alerts name customers and amounts),
 * and under /me/notifications for customers. Each side refuses the other, so
 * a staff session can never read its alerts past the second step.
 *
 * Every lookup goes through $user->notifications(): an id that belongs to
 * someone else is simply not found.
 */
class NotificationController extends Controller
{
    private const FEED_SIZE = 8;

    public function index(Request $request): JsonResponse
    {
        $user = $this->owner($request);
        $validated = $request->validate([
            'filter' => ['sometimes', Rule::in(['all', 'unread'])],
            'category' => ['sometimes', Rule::in(NotificationType::categoriesFor($user))],
            'locale' => ['sometimes', Rule::in(['bn', 'en'])],
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:5', 'max:50'],
        ]);
        $locale = $validated['locale'] ?? $user->locale;

        $page = $user->notifications()
            ->when(($validated['filter'] ?? 'all') === 'unread', fn ($query) => $query->whereNull('read_at'))
            ->when($validated['category'] ?? null, fn ($query, $category) => $query
                ->whereIn('type', NotificationType::valuesInCategory($category)))
            ->paginate($validated['per_page'] ?? 20);

        return response()->json([
            'data' => $this->present($page->getCollection(), $locale),
            'meta' => [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
                'unread' => $user->unreadNotifications()->count(),
            ],
        ]);
    }

    /** The bell: how many are unread, and the newest few. Polled while a page is open. */
    public function feed(Request $request): JsonResponse
    {
        $user = $this->owner($request);
        $validated = $request->validate(['locale' => ['sometimes', Rule::in(['bn', 'en'])]]);

        return response()
            ->json([
                'data' => $this->present(
                    $user->notifications()->limit(self::FEED_SIZE)->get(),
                    $validated['locale'] ?? $user->locale,
                ),
                'meta' => ['unread' => $user->unreadNotifications()->count()],
            ])
            ->header('Cache-Control', 'private, no-store');
    }

    public function read(Request $request, string $notification): JsonResponse
    {
        $this->find($request, $notification)->markAsRead();

        return $this->unread($request);
    }

    public function unreadOne(Request $request, string $notification): JsonResponse
    {
        $this->find($request, $notification)->markAsUnread();

        return $this->unread($request);
    }

    public function destroy(Request $request, string $notification): JsonResponse
    {
        $this->find($request, $notification)->delete();

        return $this->unread($request);
    }

    public function readAll(Request $request): JsonResponse
    {
        $this->owner($request)->unreadNotifications()->update(['read_at' => now()]);

        return $this->unread($request);
    }

    /** Deletes the ones already read. Unread notifications are kept. */
    public function clearRead(Request $request): JsonResponse
    {
        $this->owner($request)->notifications()->whereNotNull('read_at')->delete();

        return $this->unread($request);
    }

    private function unread(Request $request): JsonResponse
    {
        return response()->json(['meta' => ['unread' => $this->owner($request)->unreadNotifications()->count()]]);
    }

    private function find(Request $request, string $id): DatabaseNotification
    {
        abort_unless(preg_match('/^[0-9a-f-]{36}$/', $id) === 1, 404);

        return $this->owner($request)->notifications()->whereKey($id)->firstOrFail();
    }

    private function owner(Request $request): User
    {
        $user = $request->user();
        $staffRoute = $request->is('api/v1/admin/*');

        abort_if($staffRoute && ! $user->isStaff(), 403);
        abort_if(! $staffRoute && $user->isStaff(), 403, 'Staff notifications are in the dashboard.');

        return $user;
    }

    /**
     * @param  iterable<DatabaseNotification>  $notifications
     * @return list<array<string, mixed>>
     */
    private function present(iterable $notifications, string $locale): array
    {
        $items = [];
        foreach ($notifications as $notification) {
            $view = NotificationPresenter::present($notification->type, (array) $notification->data, $locale);
            if (! $view) {
                continue;
            }
            $items[] = $view + [
                'id' => $notification->id,
                'read' => $notification->read_at !== null,
                'created_at' => $notification->created_at?->toIso8601String(),
            ];
        }

        return $items;
    }
}
