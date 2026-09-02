<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Invoice extends Model
{
    protected $fillable = [
        'order_id', 'number', 'currency', 'total_minor', 'snapshot',
        'document_disk', 'document_path', 'issued_at',
    ];

    protected function casts(): array
    {
        return ['snapshot' => 'array', 'total_minor' => 'integer', 'issued_at' => 'datetime'];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function getRouteKeyName(): string
    {
        return 'number';
    }
}
