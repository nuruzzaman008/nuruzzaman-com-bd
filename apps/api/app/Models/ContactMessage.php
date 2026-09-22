<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ContactMessage extends Model
{
    protected $fillable = ['name', 'email', 'subject', 'message', 'ip_address', 'handled_at'];

    protected function casts(): array
    {
        return ['handled_at' => 'datetime'];
    }

    public function replies(): HasMany
    {
        return $this->hasMany(ContactMessageReply::class)->orderBy('id');
    }
}
