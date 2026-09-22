<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One person's email choice for one notification category. */
class NotificationPreference extends Model
{
    protected $fillable = ['user_id', 'category', 'email'];

    protected function casts(): array
    {
        return ['email' => 'boolean'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
