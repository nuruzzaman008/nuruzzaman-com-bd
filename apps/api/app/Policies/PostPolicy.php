<?php

namespace App\Policies;

use App\Models\Post;
use App\Models\User;

class PostPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermission('posts.view');
    }

    public function view(User $user, Post $post): bool
    {
        return $user->hasPermission('posts.view');
    }

    public function create(User $user): bool
    {
        return $user->hasPermission('posts.create');
    }

    public function update(User $user, Post $post): bool
    {
        if ($user->hasPermission('posts.update')) {
            return true;
        }

        // Contributors may keep editing their own drafts but not published work.
        return $user->hasPermission('posts.create')
            && $post->author?->user_id === $user->getKey()
            && ! $post->status->isPubliclyVisible();
    }

    public function publish(User $user, Post $post): bool
    {
        return $user->hasPermission('posts.publish');
    }

    public function delete(User $user, Post $post): bool
    {
        return $user->hasPermission('posts.delete');
    }
}
