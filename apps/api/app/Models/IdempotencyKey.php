<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class IdempotencyKey extends Model
{
    protected $fillable = [
        'key', 'scope', 'user_id', 'method', 'path', 'request_hash',
        'response_status', 'response_body', 'locked_at', 'completed_at',
    ];

    protected function casts(): array
    {
        return ['locked_at' => 'datetime', 'completed_at' => 'datetime'];
    }
}
