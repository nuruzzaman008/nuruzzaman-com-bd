<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One row of the email log: an email the site sent, or tried to.
 *
 * Rows with source "notification" are the notification emails themselves and
 * are sent from here (SendNotificationEmail); rows with source "mail" record
 * the site's other emails as they go out.
 */
class NotificationEmail extends Model
{
    public const PENDING = 'pending';

    public const SENT = 'sent';

    public const FAILED = 'failed';

    protected $fillable = [
        'user_id', 'notification_id', 'source', 'type', 'recipient', 'subject', 'locale',
        'payload', 'status', 'attempts', 'last_attempt_at', 'sent_at', 'failed_at', 'failure_reason',
    ];

    protected function casts(): array
    {
        return [
            'payload' => 'array',
            'attempts' => 'integer',
            'last_attempt_at' => 'datetime',
            'sent_at' => 'datetime',
            'failed_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
