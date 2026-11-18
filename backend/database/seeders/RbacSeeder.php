<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Reference data that supabase/migrations inserted directly: RBAC catalogue and app settings.
 * Source rows live in data/rbac.json.
 */
class RbacSeeder extends Seeder
{
    public function run(): void
    {
        $data = json_decode(file_get_contents(__DIR__.'/data/rbac.json'), true, flags: JSON_THROW_ON_ERROR);

        DB::table('rbac_access_areas')->insert($data['areas']);
        DB::table('rbac_actions')->insert($data['actions']);

        $permissionIds = [];
        foreach ($data['permissions'] as $p) {
            $id = (string) Str::uuid();
            $permissionIds["{$p['area']}.{$p['action']}"] = $id;
            DB::table('rbac_permissions')->insert([
                'id' => $id,
                'access_area_key' => $p['area'],
                'action_key' => $p['action'],
                'access_label' => $p['access_label'],
                'description' => $p['description'],
                'status' => $p['status'],
            ]);
        }

        DB::table('rbac_roles')->insert($data['roles']);

        foreach ($data['role_permissions'] as $role => $keys) {
            DB::table('rbac_role_permissions')->insert(array_map(
                fn (string $key) => ['role_key' => $role, 'permission_id' => $permissionIds[$key]],
                $keys,
            ));
        }

        foreach ($data['app_settings'] as $s) {
            DB::table('app_settings')->insert(['key' => $s['key'], 'value' => json_encode($s['value'])]);
        }
    }
}
