<?php

namespace Database\Seeders;

use App\Models\Author;
use Illuminate\Database\Seeder;

class AuthorSeeder extends Seeder
{
    public function run(): void
    {
        Author::query()->updateOrCreate(
            ['slug' => 'nuruzzaman'],
            [
                'name' => 'Engr. Md. Nuruzzaman',
                'credentials' => 'RSE',
                'headline' => 'Structural engineer, AutoCAD automation developer, and instructor.',
                // The public biography is owner-supplied; until it is provided
                // the profile page renders the headline only.
                'bio' => null,
                'same_as' => ['https://nbconsultant.com.bd'],
                'is_reviewer' => true,
            ],
        );
    }
}
