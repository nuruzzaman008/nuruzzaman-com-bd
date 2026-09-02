<?php

namespace App\Policies;

use App\Models\Course;
use App\Models\User;

class CoursePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermission('courses.view');
    }

    public function view(User $user, Course $course): bool
    {
        return $user->hasPermission('courses.view') || $this->teaches($user, $course);
    }

    public function create(User $user): bool
    {
        return $user->hasPermission('courses.manage');
    }

    public function update(User $user, Course $course): bool
    {
        return $user->hasPermission('courses.manage') || $this->teaches($user, $course);
    }

    public function publish(User $user, Course $course): bool
    {
        return $user->hasPermission('courses.publish');
    }

    public function delete(User $user, Course $course): bool
    {
        return $user->hasPermission('courses.manage');
    }

    /** An instructor may edit and report on the courses they are assigned to. */
    public function teaches(User $user, Course $course): bool
    {
        return $course->instructors()->where('user_id', $user->getKey())->exists();
    }
}
