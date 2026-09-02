<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class Cart extends Model
{
    protected $fillable = ['token', 'user_id', 'currency', 'status', 'coupon_id', 'expires_at'];

    protected function casts(): array
    {
        return ['expires_at' => 'datetime'];
    }

    protected static function booted(): void
    {
        static::creating(function (self $cart) {
            $cart->token ??= (string) Str::uuid();
            $cart->expires_at ??= now()->addDays(30);
        });
    }

    public function items(): HasMany
    {
        return $this->hasMany(CartItem::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function coupon(): BelongsTo
    {
        return $this->belongsTo(Coupon::class);
    }

    public function getRouteKeyName(): string
    {
        return 'token';
    }
}
