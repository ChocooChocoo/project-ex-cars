<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

/**
 * `php artisan migrate:fresh --seed` gives a working demo database.
 * Replaces scripts/seed-users.cjs, scripts/seed-roles.sql and `npm run seed:data`.
 */
class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call(RbacSeeder::class);
        $users = (new UserSeeder)->run();
        (new DemoDataSeeder)->setCommand($this->command)->run($users);
    }
}
