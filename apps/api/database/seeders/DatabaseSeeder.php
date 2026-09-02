<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            RoleSeeder::class,
            AdminUserSeeder::class,
            SettingSeeder::class,
            AuthorSeeder::class,
            PageSeeder::class,
            BlogSeeder::class,
            CatalogSeeder::class,
            CourseSeeder::class,
        ]);
    }
}
