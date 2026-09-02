<?php

namespace App\Policies;

use App\Models\SupportTicket;
use App\Models\User;

class SupportTicketPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermission('support.manage');
    }

    public function view(User $user, SupportTicket $ticket): bool
    {
        return $ticket->user_id === $user->getKey() || $user->hasPermission('support.manage');
    }

    public function reply(User $user, SupportTicket $ticket): bool
    {
        return $this->view($user, $ticket);
    }

    public function manage(User $user): bool
    {
        return $user->hasPermission('support.manage');
    }
}
