<?php

namespace Database\Seeders;

use App\Enums\Role as RoleEnum;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * Creates the owner's staff account.
 *
 * The password is never written down in this repository. It comes from
 * NB_ADMIN_PASSWORD; outside local and testing the seeder refuses to create the
 * account without one, so no deployment can inherit a password that is public in
 * the source. In local development a random password is generated and printed
 * once, which keeps a fresh checkout usable without inventing a default that
 * would then be the same on every machine in the world.
 *
 * An existing account is never given a new password by re-seeding: that would
 * silently reset a password the owner has since changed.
 */
class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        $email = (string) config('nb.seed.owner_email');
        $existing = User::query()->where('email', $email)->first();

        if ($existing) {
            $this->attachRole($existing);
            $this->command?->info("Admin account already exists: {$email} (password unchanged).");

            return;
        }

        $password = config('nb.seed.owner_password');
        $generated = false;

        if (blank($password)) {
            if (! app()->environment(['local', 'testing'])) {
                $this->command?->warn(
                    'NB_ADMIN_PASSWORD is not set; no admin account was created. '
                    .'Set it and re-run this seeder.',
                );

                return;
            }

            $password = Str::password(20);
            $generated = true;
        }

        $user = User::query()->create([
            'name' => (string) config('nb.seed.owner_name'),
            'email' => $email,
            'password' => Hash::make($password),
            'email_verified_at' => now(),
            'status' => 'active',
        ]);

        $this->attachRole($user);

        if ($generated) {
            // Printed once, here only. It is not stored anywhere else.
            $this->command?->warn('Generated a development admin password — copy it now:');
            $this->command?->line("  email:    {$email}");
            $this->command?->line("  password: {$password}");
            $this->command?->warn('Change it after your first sign-in.');
        } else {
            $this->command?->info("Admin account created: {$email}");
        }
    }

    private function attachRole(User $user): void
    {
        $role = Role::query()->where('name', RoleEnum::SuperAdmin->value)->first();

        if ($role && ! $user->roles()->whereKey($role->getKey())->exists()) {
            $user->roles()->attach($role);
        }
    }
}
