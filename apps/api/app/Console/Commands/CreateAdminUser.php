<?php

namespace App\Console\Commands;

use App\Enums\Role as RoleEnum;
use App\Models\Role;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * Creates or promotes a staff account. The password is generated here and
 * printed once so it is never checked into configuration.
 */
class CreateAdminUser extends Command
{
    protected $signature = 'platform:make-admin {email} {--name=} {--role=super_admin}';

    protected $description = 'Create or promote a staff user.';

    public function handle(): int
    {
        $roleName = $this->option('role');

        if (! in_array($roleName, RoleEnum::values(), true)) {
            $this->error('Unknown role: '.$roleName);

            return self::FAILURE;
        }

        $role = Role::query()->where('name', $roleName)->first();

        if (! $role) {
            $this->error('Roles are not seeded yet. Run `php artisan db:seed --class=RoleSeeder` first.');

            return self::FAILURE;
        }

        $password = Str::password(16);
        $user = User::query()->firstOrCreate(
            ['email' => $this->argument('email')],
            [
                'name' => $this->option('name') ?: $this->argument('email'),
                'password' => Hash::make($password),
                'email_verified_at' => now(),
            ],
        );

        $user->roles()->syncWithoutDetaching([$role->getKey()]);

        $this->info("User {$user->email} now has the {$roleName} role.");

        if ($user->wasRecentlyCreated) {
            $this->warn('Temporary password (shown once): '.$password);
            $this->warn('Change it immediately and enable MFA before production use.');
        }

        return self::SUCCESS;
    }
}
