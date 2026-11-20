<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

/**
 * `php artisan migrate:fresh --seed` populates a fresh local database.
 * Replaces scripts/seed-users.cjs, scripts/seed-roles.sql and `npm run seed:data`.
 */
class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment('local', 'testing')) {
            throw new \RuntimeException('The seeded business records are only for local and testing environments.');
        }

        $this->call(RbacSeeder::class);
        $users = (new UserSeeder)->run();
        (new DemoDataSeeder)->setCommand($this->command)->run($users);
    }
}
