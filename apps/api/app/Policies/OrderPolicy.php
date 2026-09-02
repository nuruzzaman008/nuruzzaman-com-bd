<?php

namespace App\Policies;

use App\Models\Order;
use App\Models\User;

class OrderPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermission('orders.view');
    }

    public function view(User $user, Order $order): bool
    {
        return $order->user_id === $user->getKey() || $user->hasPermission('orders.view');
    }

    public function refund(User $user, Order $order): bool
    {
        return $user->hasPermission('orders.refund');
    }

    public function manage(User $user): bool
    {
        return $user->hasPermission('orders.manage');
    }
}
