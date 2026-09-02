<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ActivationRequestEvent extends Model
{
    protected $fillable = [
        'activation_request_id', 'from_status', 'to_status', 'note', 'actor_id',
    ];

    public function request(): BelongsTo
    {
        return $this->belongsTo(ActivationRequest::class, 'activation_request_id');
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }
}
