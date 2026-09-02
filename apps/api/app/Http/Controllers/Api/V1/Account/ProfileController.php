<?php

namespace App\Http\Controllers\Api\V1\Account;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Support\Audit;
use Illuminate\Http\Request;

class ProfileController extends Controller
{
    public function show(Request $request): UserResource
    {
        return new UserResource($request->user()->load('profile', 'roles'));
    }

    public function update(Request $request): UserResource
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'min:2', 'max:120'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:32'],
            'locale' => ['sometimes', 'string', 'in:bn,en'],
            'timezone' => ['sometimes', 'string', 'timezone'],
            'profile.display_name' => ['sometimes', 'nullable', 'string', 'max:120'],
            'profile.headline' => ['sometimes', 'nullable', 'string', 'max:180'],
            'profile.bio' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'profile.organization' => ['sometimes', 'nullable', 'string', 'max:160'],
            'profile.designation' => ['sometimes', 'nullable', 'string', 'max:160'],
            'profile.district' => ['sometimes', 'nullable', 'string', 'max:80'],
            'profile.links' => ['sometimes', 'array', 'max:6'],
            'profile.links.*' => ['url', 'max:255'],
        ]);

        $user = $request->user();
        $user->fill(collect($validated)->except('profile')->all())->save();

        if (isset($validated['profile'])) {
            $user->profile()->updateOrCreate(['user_id' => $user->getKey()], $validated['profile']);
        }

        Audit::record('account.profile_updated', $user, [], $user->getKey());

        return new UserResource($user->fresh()->load('profile', 'roles'));
    }
}
