<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Profile extends Model
{
    protected $fillable = [
        'user_id', 'display_name', 'headline', 'bio', 'organization',
        'designation', 'district', 'avatar_path', 'links',
    ];

    protected function casts(): array
    {
        return ['links' => 'array'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
