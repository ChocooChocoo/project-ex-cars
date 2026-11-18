<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Demo accounts: replaces scripts/seed-users.cjs + scripts/seed-roles.sql.
 * One known account per role (all ten), plus the extra field staff the demo data assigns work to.
 * Also does what Supabase's handle_new_user / handle_new_user_role triggers did: profile + role row.
 */
class UserSeeder extends Seeder
{
    /** @var array<string, array{0: string, 1: string, 2: string}> key => [role, full name, email] */
    public const USERS = [
        'customer' => ['customer', 'Juan Dela Cruz', 'customer@gce.local'],
        'ceo' => ['ceo', 'Roberto Gonzales', 'ceo@gce.local'],
        'super_admin' => ['super_admin', 'Sofia Navarro', 'super_admin@gce.local'],
        'account_manager' => ['account_manager', 'Angela Reyes', 'account_manager@gce.local'],
        'head_accountant' => ['head_accountant', 'Benjamin Tan', 'head_accountant@gce.local'],
        'confidential_informant' => ['confidential_informant', 'Carlos Mendoza', 'confidential_informant@gce.local'],
        'confidential_informant2' => ['confidential_informant', 'Rodel Pascual', 'confidential_informant2@gce.local'],
        'confidential_informant3' => ['confidential_informant', 'Liza Manalo', 'confidential_informant3@gce.local'],
        'confidential_informant4' => ['confidential_informant', 'Joy Bautista', 'confidential_informant4@gce.local'],
        'marketing_specialist' => ['marketing_specialist', 'Diana Lim', 'marketing_specialist@gce.local'],
        'mechanic' => ['mechanic', 'Eduardo Aquino', 'mechanic@gce.local'],
        'mechanic2' => ['mechanic', 'Noel Ramirez', 'mechanic2@gce.local'],
        'mechanic3' => ['mechanic', 'Arnel Santiago', 'mechanic3@gce.local'],
        'mechanic4' => ['mechanic', 'Ramon Dela Cruz', 'mechanic4@gce.local'],
        'sales_manager' => ['sales_manager', 'Fatima Castro', 'sales_manager@gce.local'],
        'head_security' => ['head_security', 'Gregorio Villanueva', 'head_security@gce.local'],
    ];

    /** @return array<string, string> key => user id */
    public function run(): array
    {
        $password = env('SEED_USER_PASSWORD');
        if (! $password) {
            throw new RuntimeException('SEED_USER_PASSWORD is not set in backend/.env.');
        }
        $hash = Hash::make($password);

        $ids = [];
        foreach (self::USERS as $key => [$role, $name, $email]) {
            $id = (string) Str::uuid();
            $ids[$key] = $id;
            DB::table('users')->insert(['id' => $id, 'email' => $email, 'password' => $hash, 'email_verified_at' => now()]);
            DB::table('profiles')->insert(['id' => $id, 'full_name' => $name, 'account_state' => 'active', 'activated_at' => now()]);
            DB::table('user_roles')->insert(['account_id' => $id, 'role' => $role, 'active' => true]);
        }

        return $ids;
    }
}
