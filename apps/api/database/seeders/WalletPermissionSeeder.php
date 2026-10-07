<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;

class WalletPermissionSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        foreach (['wallets.view' => 'View wallet balances, transactions and device sync status', 'wallets.manage' => 'Adjust tokens and change wallet status with an audit trail'] as $name => $description) {
            $permission = Permission::firstOrCreate(['name' => $name], ['group' => 'commerce', 'description' => $description]);
            $role = Role::where('name', 'admin')->first();
            $role?->permissions()->syncWithoutDetaching([$permission->id]);
        }
    }
}
