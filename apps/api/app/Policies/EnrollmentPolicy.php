<?php

namespace App\Policies;

use App\Models\Enrollment;
use App\Models\User;

class EnrollmentPolicy
{
    public function view(User $user, Enrollment $enrollment): bool
    {
        return $enrollment->user_id === $user->getKey() || $user->hasPermission('courses.view');
    }

    public function learn(User $user, Enrollment $enrollment): bool
    {
        return $enrollment->user_id === $user->getKey() && $enrollment->isUsable();
    }

    public function manage(User $user): bool
    {
        return $user->hasPermission('enrollments.manage');
    }
}
