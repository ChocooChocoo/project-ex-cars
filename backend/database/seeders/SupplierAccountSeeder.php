<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Adds the seeded supplier account to a database that was seeded before suppliers existed (production).
 * Safe to run twice: it does nothing when supplier@gce.local already exists.
 *
 *   SEED_USER_PASSWORD=... php artisan db:seed --class=SupplierAccountSeeder --force
 */
class SupplierAccountSeeder extends Seeder
{
    public function run(): void
    {
        [$role, $name, $email] = UserSeeder::USERS['supplier'];
        if (DB::table('users')->where('email', $email)->exists()) {
            $this->command?->info("{$email} already exists.");

            return;
        }
        $password = env('SEED_USER_PASSWORD');
        if (! $password) {
            throw new RuntimeException('SEED_USER_PASSWORD is not set.');
        }
        DB::transaction(function () use ($role, $name, $email, $password) {
            $id = (string) Str::uuid();
            DB::table('users')->insert(['id' => $id, 'email' => $email, 'password' => Hash::make($password), 'email_verified_at' => now()]);
            DB::table('profiles')->insert(['id' => $id, 'full_name' => $name, 'account_state' => 'active', 'activated_at' => now()]);
            DB::table('user_roles')->insert(['account_id' => $id, 'role' => $role, 'active' => true]);
            UserSeeder::supplierProfile($id);
        });
        $this->command?->info("{$email} created.");
    }
}
