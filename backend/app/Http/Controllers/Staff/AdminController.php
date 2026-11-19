<?php

namespace App\Http\Controllers\Staff;

use App\Http\Controllers\Catalogue\ShowroomController;
use App\Http\Controllers\Controller;
use App\Models\AppSetting;
use App\Services\Trading\Trading;
use App\Support\ApiRow;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Account and system administration (was src/app/(staff)/users, roles and settings over get_all_user_roles,
 * auth.admin.listUsers, the rbac_* RLS, update_rbac_role and app_settings). Super Admin manages accounts, RBAC
 * and settings but reads no business data; the routes carry the role lists.
 */
class AdminController extends Controller
{
    private const RBAC_ROLES = ['account_manager', 'head_accountant', 'confidential_informant', 'marketing_specialist', 'mechanic', 'sales_manager', 'head_security'];

    /** Every account with email, state and active role (CEO/AM/Super Admin). */
    private static function accounts(): Collection
    {
        return DB::table('profiles as p')->leftJoin('users as u', 'u.id', '=', 'p.id')
            ->leftJoin('user_roles as r', fn ($j) => $j->on('r.account_id', '=', 'p.id')->where('r.active', true))
            ->orderBy('p.full_name')->get(['p.id', 'p.full_name', 'p.account_state', 'p.created_at', 'u.email', 'r.role']);
    }

    public function users(): JsonResponse
    {
        return response()->json(['users' => self::accounts()->map(fn ($a) => [
            'id' => $a->id, 'email' => $a->email ?? '', 'fullName' => $a->full_name, 'accountState' => $a->account_state,
            'role' => $a->role ?? 'customer', 'createdAt' => ApiRow::iso($a->created_at),
        ])]);
    }

    /** initcap(replace(key, '_', ' ')) as the old generated column did. */
    private static function initcap(string $key): string
    {
        return ucwords(strtolower(str_replace('_', ' ', $key)), " -\t");
    }

    public function rbac(Request $request): JsonResponse
    {
        $assignments = DB::table('rbac_role_permissions')->get(['role_key', 'permission_id'])->groupBy('role_key');
        $catalog = fn (string $table) => DB::table($table)->orderBy('sort_order')->get(['key', 'label', 'sort_order'])
            ->map(fn ($r) => ['key' => $r->key, 'label' => $r->label, 'sortOrder' => (int) $r->sort_order]);

        return response()->json([
            'canManage' => $request->user()->hasRole('ceo', 'super_admin'),
            'users' => self::accounts()->map(fn ($a) => ['id' => $a->id, 'fullName' => $a->full_name ?? 'Unknown', 'accountState' => $a->account_state,
                'role' => $a->role ?? 'customer', 'createdAt' => ApiRow::iso($a->created_at)]),
            'roles' => DB::table('rbac_roles')->orderBy('role_key')->get()->map(fn ($r) => [
                'roleKey' => $r->role_key, 'description' => $r->description, 'status' => $r->status, 'isProtected' => (bool) $r->is_protected,
                'permissionIds' => ($assignments[$r->role_key] ?? collect())->pluck('permission_id')->values(),
            ]),
            'permissions' => DB::table('rbac_permissions')->orderBy('permission_key')->get()->map(fn ($p) => [
                'id' => $p->id, 'accessAreaKey' => $p->access_area_key, 'actionKey' => $p->action_key,
                'accessLabel' => $p->access_label ?? self::initcap($p->action_key).' '.self::initcap($p->access_area_key),
                'permissionKey' => $p->permission_key, 'description' => $p->description, 'status' => $p->status,
            ]),
            'accessAreas' => $catalog('rbac_access_areas'),
            'actions' => $catalog('rbac_actions'),
        ]);
    }

    private static function roleFields(Request $request): array
    {
        $data = $request->validate([
            'role_key' => ['required', 'in:'.implode(',', self::RBAC_ROLES)],
            'description' => ['nullable', 'string', 'max:1000'],
            'status' => ['required', 'in:active,inactive'],
            'is_protected' => ['required', 'boolean'],
        ], ['status.in' => 'Invalid RBAC role status']);
        $description = trim((string) ($data['description'] ?? ''));

        return ['role_key' => $data['role_key'], 'description' => $description === '' ? null : $description, 'status' => $data['status'],
            'is_protected' => (bool) $data['is_protected']];
    }

    public function createRole(Request $request): JsonResponse
    {
        $fields = self::roleFields($request);
        abort_if(DB::table('rbac_roles')->where('role_key', $fields['role_key'])->exists(), 409, 'That role already exists.');
        DB::table('rbac_roles')->insert($fields + ['created_at' => now(), 'updated_at' => now()]);

        return response()->json(['success' => true]);
    }

    public function createPermission(Request $request): JsonResponse
    {
        $data = $request->validate([
            'access_area_key' => ['required', 'exists:rbac_access_areas,key'],
            'action_key' => ['required', 'exists:rbac_actions,key'],
            'description' => ['nullable', 'string', 'max:1000'],
            'status' => ['required', 'in:active,inactive'],
        ]);
        abort_if(DB::table('rbac_permissions')->where('access_area_key', $data['access_area_key'])->where('action_key', $data['action_key'])->exists(),
            409, 'That permission already exists.');
        DB::table('rbac_permissions')->insert([
            'id' => (string) Str::uuid(), 'access_area_key' => $data['access_area_key'], 'action_key' => $data['action_key'],
            'access_label' => self::initcap($data['action_key']).' '.self::initcap($data['access_area_key']),
            'description' => ($data['description'] ?? '') === '' ? null : trim($data['description']), 'status' => $data['status'], 'created_at' => now(),
        ]);

        return response()->json(['success' => true]);
    }

    /** update_rbac_role: only active permissions; the role's set is replaced in one transaction. */
    public function updateRole(Request $request): JsonResponse
    {
        $fields = self::roleFields($request);
        $ids = array_values(array_unique($request->validate(['permission_ids' => ['nullable', 'array'], 'permission_ids.*' => ['uuid']])['permission_ids'] ?? []));
        abort_unless(DB::table('rbac_roles')->where('role_key', $fields['role_key'])->exists(), 404, 'RBAC role not found');
        abort_if(count($ids) !== DB::table('rbac_permissions')->whereIn('id', $ids)->where('status', 'active')->count(), 422, 'Only active permissions can be assigned');
        DB::transaction(function () use ($fields, $ids) {
            DB::table('rbac_roles')->where('role_key', $fields['role_key'])->update($fields + ['updated_at' => now()]);
            DB::table('rbac_role_permissions')->where('role_key', $fields['role_key'])->delete();
            DB::table('rbac_role_permissions')->insert(array_map(fn ($id) => ['role_key' => $fields['role_key'], 'permission_id' => $id, 'assigned_at' => now()], $ids));
        });

        return response()->json(['success' => true]);
    }

    public function settings(): JsonResponse
    {
        return response()->json(['financingMarkupPct' => ShowroomController::globalMarkupPct()]);
    }

    /** CEO or Super Admin (AppSettingPolicy); audited. */
    public function updateMarkup(Request $request): JsonResponse
    {
        $actor = $request->user();
        abort_unless($actor->can('update', AppSetting::class), 403, 'Not authorized');
        $value = $request->input('value');
        abort_unless(is_numeric($value), 422, 'Enter a percentage.');
        abort_if((float) $value < 0, 422, 'The profit cannot be negative.');
        abort_if((float) $value > 100, 422, 'The profit cannot exceed 100%.');
        $pct = round((float) $value, 2);
        $id = Trading::run(function () use ($actor, $pct) {
            $setting = DB::table('app_settings')->where('key', 'financing_markup_pct')->lockForUpdate()->first(['id']);
            abort_unless($setting, 409, 'The setting could not be saved.');
            DB::table('app_settings')->where('key', 'financing_markup_pct')->update(['value' => json_encode($pct), 'updated_by' => $actor->id, 'updated_at' => now()]);
            Trading::audit($actor->id, 'financing_markup_updated', 'app_setting', $setting->id, 'Financing profit set to '.(floor($pct) == $pct ? (int) $pct : $pct).'%');

            return $setting->id;
        });

        return response()->json(['success' => true, 'pct' => $pct]);
    }
}
