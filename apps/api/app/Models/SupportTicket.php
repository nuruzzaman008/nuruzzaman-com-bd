<?php

namespace App\Models;

use App\Enums\SupportTicketStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SupportTicket extends Model
{
    protected $fillable = [
        'reference', 'user_id', 'name', 'email', 'subject', 'category',
        'status', 'priority', 'order_id', 'assigned_to', 'resolved_at',
    ];

    protected function casts(): array
    {
        return ['status' => SupportTicketStatus::class, 'resolved_at' => 'datetime'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function messages(): HasMany
    {
        return $this->hasMany(SupportTicketMessage::class)->orderBy('id');
    }

    public function getRouteKeyName(): string
    {
        return 'reference';
    }
}
