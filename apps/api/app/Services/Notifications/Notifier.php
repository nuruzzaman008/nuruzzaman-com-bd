<?php

namespace App\Services\Notifications;

use App\Jobs\SendNotificationEmail;
use App\Models\NotificationEmail;
use App\Models\User;
use App\Notifications\NotificationPresenter;
use App\Notifications\NotificationType;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Throwable;

/**
 * Writes notifications.
 *
 * The in-app row is written at once, in whatever transaction the event itself
 * is in, so an order and its alert commit or roll back together. The email is
 * a row in the email log plus a queued job that runs only after that commit:
 * a rolled-back order sends nothing, and a mail outage delays an email but
 * cannot lose it (the log keeps it, and it is retried).
 *
 * Nothing here may break the action that caused it. A failure to notify is
 * reported and swallowed; the order still goes through.
 */
class Notifier
{
    /**
     * Tells every active staff member allowed to act on it, except the person
     * who did it.
     *
     * @param  array<string, mixed>  $data
     * @param  (callable(Builder<User>): void)|null  $narrow
     */
    public function toStaff(NotificationType $type, array $data, ?callable $narrow = null): void
    {
        $this->safely(function () use ($type, $data, $narrow) {
            $staff = $this->staffFor($type, $narrow);
            foreach ($staff as $user) {
                $this->deliver($user, $type, $data);
            }
        });
    }

    /** @param  array<string, mixed>  $data */
    public function toUser(?User $user, NotificationType $type, array $data): void
    {
        if (! $user || ! $user->isActive()) {
            return;
        }

        $this->safely(fn () => $this->deliver($user, $type, $data));
    }

    /**
     * @param  iterable<User>  $users
     * @param  array<string, mixed>  $data
     */
    public function toUsers(iterable $users, NotificationType $type, array $data): void
    {
        $this->safely(function () use ($users, $type, $data) {
            foreach ($users as $user) {
                if ($user->isActive()) {
                    $this->deliver($user, $type, $data);
                }
            }
        });
    }

    /** @return Collection<int, User> */
    public function staffFor(NotificationType $type, ?callable $narrow = null): Collection
    {
        $permission = $type->permission();

        $query = User::query()
            ->where('status', 'active')
            ->whereHas('roles', function (Builder $roles) use ($permission) {
                $roles->where('name', 'super_admin');
                if ($permission) {
                    $roles->orWhereHas('permissions', fn (Builder $p) => $p->where('name', $permission));
                }
            });

        if ($actor = auth()->id()) {
            $query->whereKeyNot($actor);
        }
        if ($narrow) {
            $narrow($query);
        }

        return $query->with('roles')->get()->filter(fn (User $user) => $user->isStaff())->values();
    }

    public function wantsEmail(User $user, NotificationType $type): bool
    {
        if (! $type->hasEmail() || ! filled($user->email)) {
            return false;
        }

        $chosen = DB::table('notification_preferences')
            ->where('user_id', $user->getKey())
            ->where('category', $type->category())
            ->value('email');

        return $chosen === null ? $type->emailByDefault($user) : (bool) $chosen;
    }

    /** @param  array<string, mixed>  $data */
    private function deliver(User $user, NotificationType $type, array $data): void
    {
        $id = (string) Str::uuid();
        $user->notifications()->create([
            'id' => $id,
            'type' => $type->value,
            'data' => $data,
        ]);

        if (! $this->wantsEmail($user, $type)) {
            return;
        }

        $locale = $user->locale === 'en' ? 'en' : 'bn';
        $email = NotificationEmail::query()->create([
            'user_id' => $user->getKey(),
            'notification_id' => $id,
            'source' => 'notification',
            'type' => $type->value,
            'recipient' => $user->email,
            'subject' => NotificationPresenter::present($type->value, $data, $locale)['title'] ?? $type->value,
            'locale' => $locale,
            'payload' => $data,
            'status' => NotificationEmail::PENDING,
        ]);

        SendNotificationEmail::dispatch($email->getKey())->afterCommit();
    }

    private function safely(callable $work): void
    {
        try {
            $work();
        } catch (Throwable $exception) {
            report($exception);
        }
    }
}
