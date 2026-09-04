<?php

namespace App\Models;

use App\Enums\CommentStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class PostComment extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'post_id', 'user_id', 'author_name', 'body', 'rating',
        'status', 'approved_at', 'approved_by', 'ip_hash',
    ];

    protected $hidden = ['ip_hash'];

    protected function casts(): array
    {
        return [
            'status' => CommentStatus::class,
            'approved_at' => 'datetime',
            'rating' => 'integer',
        ];
    }

    public function post(): BelongsTo
    {
        return $this->belongsTo(Post::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * The only scope the public API may use.
     *
     * Everything a reader sees, everything counted into an average, and
     * everything emitted as structured data goes through here.
     */
    public function scopeApproved(Builder $query): Builder
    {
        return $query->where('status', CommentStatus::Approved->value);
    }
}
