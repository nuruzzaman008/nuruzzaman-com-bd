<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\NotificationPreference;
use App\Models\User;
use App\Notifications\NotificationType;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Which notification categories also arrive by email, per person.
 *
 * Notifications always appear in the dashboard or account; only the email is
 * optional. A category nobody has chosen for uses the role default
 * (NotificationType::emailByDefault).
 */
class NotificationPreferenceController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->preferences($request->user())]);
    }

    public function update(Request $request): JsonResponse
    {
        $user = $request->user();
        $categories = NotificationType::categoriesFor($user);

        $request->validate([
            'email' => ['required', 'array'],
            ...collect($categories)->mapWithKeys(fn (string $category) => [
                "email.$category" => ['sometimes', 'boolean'],
            ])->all(),
        ]);
        // Only this person's own categories are read; anything else sent is ignored.
        $choices = array_intersect_key((array) $request->input('email'), array_flip($categories));

        DB::transaction(function () use ($user, $choices) {
            foreach ($choices as $category => $email) {
                NotificationPreference::query()->updateOrCreate(
                    ['user_id' => $user->getKey(), 'category' => $category],
                    ['email' => filter_var($email, FILTER_VALIDATE_BOOL)],
                );
            }
        });

        return response()->json(['data' => $this->preferences($user)]);
    }

    /** @return list<array{category: string, email: bool, default: bool}> */
    private function preferences(User $user): array
    {
        $chosen = NotificationPreference::query()
            ->where('user_id', $user->getKey())
            ->pluck('email', 'category');

        return array_map(function (string $category) use ($user, $chosen) {
            $default = $user->isStaff() ? NotificationType::staffEmailDefault($user, $category) : true;

            return [
                'category' => $category,
                'email' => $chosen->has($category) ? (bool) $chosen[$category] : $default,
                'default' => $default,
            ];
        }, NotificationType::categoriesFor($user));
    }
}
