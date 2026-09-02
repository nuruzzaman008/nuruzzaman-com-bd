<?php

namespace App\Models;

use App\Enums\Role as RoleEnum;
use Database\Factories\UserFactory;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable implements MustVerifyEmail
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes;

    protected $fillable = [
        'name', 'email', 'password', 'phone', 'locale', 'timezone', 'status',
    ];

    protected $hidden = [
        'password', 'remember_token', 'mfa_secret',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'mfa_secret' => 'encrypted',
            'mfa_confirmed_at' => 'datetime',
            'last_login_at' => 'datetime',
        ];
    }

    public function profile(): HasOne
    {
        return $this->hasOne(Profile::class);
    }

    public function author(): HasOne
    {
        return $this->hasOne(Author::class);
    }

    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class);
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }

    public function enrollments(): HasMany
    {
        return $this->hasMany(Enrollment::class);
    }

    public function certificates(): HasMany
    {
        return $this->hasMany(Certificate::class);
    }

    public function supportTickets(): HasMany
    {
        return $this->hasMany(SupportTicket::class);
    }

    public function downloadEntitlements(): HasMany
    {
        return $this->hasMany(DownloadEntitlement::class);
    }

    public function softwareLicenses(): HasMany
    {
        return $this->hasMany(SoftwareLicense::class);
    }

    public function activationRequests(): HasMany
    {
        return $this->hasMany(ActivationRequest::class);
    }

    public function hasRole(RoleEnum|string ...$roles): bool
    {
        $names = array_map(fn ($role) => $role instanceof RoleEnum ? $role->value : $role, $roles);

        return $this->roleNames()->intersect($names)->isNotEmpty();
    }

    /** Super admins implicitly hold every permission. */
    public function hasPermission(string $permission): bool
    {
        if ($this->hasRole(RoleEnum::SuperAdmin)) {
            return true;
        }

        return $this->permissionNames()->contains($permission);
    }

    public function isStaff(): bool
    {
        return $this->hasRole(...array_map(fn (RoleEnum $r) => $r->value, RoleEnum::staff()));
    }

    public function isActive(): bool
    {
        return $this->status === 'active';
    }

    public function roleNames(): \Illuminate\Support\Collection
    {
        return $this->relationLoaded('roles')
            ? $this->roles->pluck('name')
            : $this->roles()->pluck('name');
    }

    public function permissionNames(): \Illuminate\Support\Collection
    {
        return Permission::query()
            ->whereHas('roles.users', fn ($query) => $query->whereKey($this->getKey()))
            ->pluck('name');
    }
}
