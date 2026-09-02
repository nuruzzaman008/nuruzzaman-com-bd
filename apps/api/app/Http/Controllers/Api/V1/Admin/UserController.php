<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\Role as RoleEnum;
use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\Role;
use App\Models\User;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class UserController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('viewAny', User::class);

        $validated = $request->validate([
            'q' => ['sometimes', 'string', 'max:120'],
            'role' => ['sometimes', 'string', 'in:'.implode(',', RoleEnum::values())],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]);

        $users = User::query()
            ->with('roles')
            ->when($validated['q'] ?? null, fn ($query, $term) => $query->where(fn ($inner) => $inner
                ->where('name', 'like', '%'.$term.'%')
                ->orWhere('email', 'like', '%'.$term.'%')))
            ->when($validated['role'] ?? null, fn ($query, $role) => $query
                ->whereHas('roles', fn ($inner) => $inner->where('name', $role)))
            ->latest('id')
            ->paginate($validated['per_page'] ?? 25);

        return UserResource::collection($users);
    }

    public function show(User $user): UserResource
    {
        $this->authorize('view', $user);

        return new UserResource($user->load(['profile', 'roles']));
    }

    public function update(Request $request, User $user): UserResource
    {
        $this->authorize('update', $user);

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:32'],
            'status' => ['sometimes', 'string', 'in:active,suspended'],
        ]);

        $user->update($validated);
        Audit::record('user.updated', $user, $validated);

        return new UserResource($user->fresh()->load(['profile', 'roles']));
    }

    /**
     * Role assignment is restricted to super admins and cannot be applied to
     * the acting account, so nobody can quietly escalate their own access.
     */
    public function syncRoles(Request $request, User $user): JsonResponse
    {
        $this->authorize('assignRoles', $user);

        $validated = $request->validate([
            'roles' => ['present', 'array', 'max:7'],
            'roles.*' => ['string', 'in:'.implode(',', RoleEnum::values())],
        ]);

        $ids = Role::query()->whereIn('name', $validated['roles'])->pluck('id');
        $user->roles()->sync($ids);

        Audit::record('user.roles_changed', $user, ['roles' => $validated['roles']]);

        return response()->json(['data' => new UserResource($user->fresh()->load('roles'))]);
    }
}
