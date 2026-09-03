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

    /**
     * The order the ticket is about, when the customer raised it from one.
     *
     * The controllers eager-load this and the resource reads it; without the
     * relation every ticket listing throws RelationNotFoundException, which went
     * unnoticed because no environment had ever had a ticket in it.
     */
    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function getRouteKeyName(): string
    {
        return 'reference';
    }
}
