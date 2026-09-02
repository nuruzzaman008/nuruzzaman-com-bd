<?php

namespace App\Enums;

/**
 * The fixed role vocabulary for the platform. Roles are stored in the `roles`
 * table; this enum is the canonical list used by seeders, policies and tests.
 */
enum Role: string
{
    case SuperAdmin = 'super_admin';
    case Admin = 'admin';
    case Editor = 'editor';
    case Instructor = 'instructor';
    case Support = 'support';
    case Student = 'student';
    case Customer = 'customer';

    public function label(): string
    {
        return match ($this) {
            self::SuperAdmin => 'Super Admin',
            self::Admin => 'Admin',
            self::Editor => 'Editor',
            self::Instructor => 'Instructor',
            self::Support => 'Support',
            self::Student => 'Student',
            self::Customer => 'Customer',
        };
    }

    /** Roles that may reach any part of the /dashboard admin surface. */
    public static function staff(): array
    {
        return [self::SuperAdmin, self::Admin, self::Editor, self::Instructor, self::Support];
    }

    public static function values(): array
    {
        return array_map(fn (self $role) => $role->value, self::cases());
    }
}
