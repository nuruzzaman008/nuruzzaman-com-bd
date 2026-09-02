<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Redirect extends Model
{
    protected $fillable = [
        'source_path', 'destination_path', 'status_code', 'is_active', 'note',
    ];

    protected function casts(): array
    {
        return ['is_active' => 'boolean', 'last_hit_at' => 'datetime'];
    }
}
