<?php

namespace App\Policies;

use App\Models\ActivationRequest;
use App\Models\User;

class ActivationRequestPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermission('activation.review');
    }

    public function view(User $user, ActivationRequest $request): bool
    {
        return $request->user_id === $user->getKey() || $user->hasPermission('activation.review');
    }

    public function review(User $user, ActivationRequest $request): bool
    {
        return $user->hasPermission('activation.review');
    }
}
