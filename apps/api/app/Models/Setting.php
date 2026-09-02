<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

class Setting extends Model
{
    protected $fillable = ['key', 'group', 'value', 'is_public'];

    protected function casts(): array
    {
        return ['value' => 'array', 'is_public' => 'boolean'];
    }

    protected static function booted(): void
    {
        static::saved(fn () => Cache::forget('settings.public'));
        static::deleted(fn () => Cache::forget('settings.public'));
    }

    public static function value(string $key, mixed $default = null): mixed
    {
        return static::query()->where('key', $key)->value('value') ?? $default;
    }

    /** @return array<string, mixed> */
    public static function publicMap(): array
    {
        return Cache::remember('settings.public', 300, fn () => static::query()
            ->where('is_public', true)
            ->pluck('value', 'key')
            ->all());
    }
}
