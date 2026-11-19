<?php

namespace Tests\Feature\Staff;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Staff\Concerns\StaffFixtures;
use Tests\TestCase;

/**
 * Phase 7: staff records, account state (policy gap 5), performance reviews, users, RBAC and settings.
 */
class AdministrationTest extends TestCase
{
    use RefreshDatabase, StaffFixtures;

    private function saveBody(string $id, array $extra = []): array
    {
        return ['account_id' => $id, 'full_name' => 'Ada Staff', 'phone' => '09170000000', 'address' => '',
            'workdays' => [1, 2, 3, 4, 5], 'start_time' => '08:00', 'end_time' => '17:00', 'grace_minutes' => 10, ...$extra];
    }

    #[Test]
    public function staff_record_save_is_ceo_or_am_and_writes_profile_schedule_and_audit(): void
    {
        $mechanic = $this->account('mechanic');
        $am = $this->account('account_manager');
        foreach (['super_admin', 'sales_manager', 'head_accountant'] as $role) {
            $this->act($this->account($role))->postJson('/api/v1/staff/staff-records/save', $this->saveBody($mechanic->id))->assertStatus(403);
        }
        $this->act($am)->postJson('/api/v1/staff/staff-records/save', $this->saveBody($mechanic->id))->assertOk()
            ->assertJsonPath('row.full_name', 'Ada Staff')->assertJsonPath('row.address', null)
            ->assertJsonPath('schedule.workdays', [1, 2, 3, 4, 5])->assertJsonPath('schedule.start_time', '08:00:00')->assertJsonPath('schedule.employee_id', $mechanic->id);
        $this->act($am)->postJson('/api/v1/staff/staff-records/save', $this->saveBody($mechanic->id, ['grace_minutes' => 5]))->assertOk()->assertJsonPath('schedule.grace_minutes', 5);
        $this->assertSame(1, DB::table('employee_work_schedules')->where('employee_id', $mechanic->id)->count());
        $this->assertSame(2, DB::table('audit_events')->where('action', 'staff_record_saved')->where('record_id', $mechanic->id)->where('actor_id', $am->id)->count());

        $this->act($am)->postJson('/api/v1/staff/staff-records/save', ['account_id' => $mechanic->id, 'full_name' => '  '])->assertStatus(422)->assertJsonPath('message', 'Full name is required.');
        $this->act($am)->postJson('/api/v1/staff/staff-records/save', ['account_id' => $mechanic->id, 'full_name' => 'A', 'start_time' => '08:00'])
            ->assertStatus(422)->assertJsonPath('message', 'A complete work schedule is required.');
        $this->act($am)->postJson('/api/v1/staff/staff-records/save', $this->saveBody($this->account('head_security')->id))->assertStatus(422)
            ->assertJsonPath('message', 'Work schedules require an active staff target.');
        // No schedule fields: profile only, no schedule.
        $this->act($am)->postJson('/api/v1/staff/staff-records/save', ['account_id' => $mechanic->id, 'full_name' => 'Ada'])->assertOk()->assertJsonPath('schedule', null);
    }

    #[Test]
    public function account_state_allows_super_admin_and_sets_activated_at_once(): void
    {
        $target = $this->account('mechanic');
        DB::table('profiles')->where('id', $target->id)->update(['activated_at' => null, 'account_state' => 'invited']);
        $this->act($this->account('sales_manager'))->postJson('/api/v1/admin/account-state', ['account_id' => $target->id, 'state' => 'active'])->assertStatus(403);
        $sa = $this->account('super_admin');
        $this->act($sa)->postJson('/api/v1/admin/account-state', ['account_id' => $target->id, 'state' => 'nope'])->assertStatus(422)->assertJsonPath('message', 'Invalid account state.');
        $first = $this->act($sa)->postJson('/api/v1/admin/account-state', ['account_id' => $target->id, 'state' => 'active'])->assertOk()
            ->assertJsonPath('row.account_state', 'active')->json('row.activated_at');
        $this->assertNotNull($first);
        $this->act($this->account('ceo'))->postJson('/api/v1/admin/account-state', ['account_id' => $target->id, 'state' => 'suspended'])->assertOk();
        $this->act($this->account('account_manager'))->postJson('/api/v1/admin/account-state', ['account_id' => $target->id, 'state' => 'active'])->assertOk()
            ->assertJsonPath('row.activated_at', $first);
        $this->assertSame(1, DB::table('audit_events')->where('action', 'account_state_suspended')->count());
        // The suspended account was refused while suspended; the active one gets in again.
        $this->act($target->fresh())->getJson('/api/v1/me')->assertOk();
    }

    #[Test]
    public function performance_reviews_are_written_by_ceo_or_am_and_read_by_scope(): void
    {
        $sm = $this->account('sales_manager');
        $mechanic = $this->account('mechanic');
        $body = ['employee_id' => $sm->id, 'review_period_start' => '2026-10-01', 'review_period_end' => '2026-10-31', 'rating' => 4, 'goals' => ''];
        $this->act($sm)->postJson('/api/v1/staff/staff-records/performance-reviews', $body)->assertStatus(403);
        $this->act($this->account('ceo'))->postJson('/api/v1/staff/staff-records/performance-reviews', $body)->assertOk();
        $this->act($this->account('account_manager'))->postJson('/api/v1/staff/staff-records/performance-reviews', [...$body, 'employee_id' => $mechanic->id])->assertOk();
        $id = DB::table('performance_reviews')->where('employee_id', $sm->id)->value('id');
        $this->act($this->account('account_manager'))->postJson('/api/v1/staff/staff-records/performance-reviews/update', [...$body, 'review_id' => $id, 'rating' => 5])->assertOk();
        $this->assertSame(5, (int) DB::table('performance_reviews')->where('id', $id)->value('rating'));

        // Sales Manager reads the staff list and only their own review.
        $page = $this->act($sm)->getJson('/api/v1/staff/staff-records')->assertOk();
        $this->assertCount(1, $page->json('reviews'));
        $this->assertCount(2, $this->act($this->account('ceo'))->getJson('/api/v1/staff/staff-records')->json('reviews'));
        $this->act($mechanic)->getJson('/api/v1/staff/staff-records')->assertStatus(403);
    }

    #[Test]
    public function users_list_is_for_ceo_am_and_super_admin(): void
    {
        $customer = $this->account('customer');
        $users = $this->act($this->account('super_admin'))->getJson('/api/v1/admin/users')->assertOk()->json('users');
        $row = collect($users)->firstWhere('id', $customer->id);
        $this->assertSame([$customer->email, 'customer', 'active'], [$row['email'], $row['role'], $row['accountState']]);
        $this->act($this->account('account_manager'))->getJson('/api/v1/admin/users')->assertOk();
        foreach (['head_accountant', 'mechanic', 'customer'] as $role) {
            $this->act($this->account($role))->getJson('/api/v1/admin/users')->assertStatus(403);
        }
    }

    #[Test]
    public function rbac_is_managed_by_ceo_or_super_admin_with_active_permissions_only(): void
    {
        DB::table('rbac_access_areas')->insert([['key' => 'field-cases', 'label' => 'Field cases', 'sort_order' => 1]]);
        DB::table('rbac_actions')->insert([['key' => 'read', 'label' => 'Read', 'sort_order' => 1], ['key' => 'approve_all', 'label' => 'Approve', 'sort_order' => 2]]);
        $sa = $this->account('super_admin');
        $this->act($this->account('account_manager'))->postJson('/api/v1/admin/rbac/roles', ['role_key' => 'mechanic', 'status' => 'active', 'is_protected' => false])->assertStatus(403);
        $this->act($this->account('account_manager'))->getJson('/api/v1/admin/rbac')->assertStatus(403);
        $this->act($sa)->postJson('/api/v1/admin/rbac/roles', ['role_key' => 'mechanic', 'status' => 'active', 'is_protected' => false])->assertOk();
        $this->act($sa)->postJson('/api/v1/admin/rbac/roles', ['role_key' => 'mechanic', 'status' => 'active', 'is_protected' => false])->assertStatus(409);
        $this->act($sa)->postJson('/api/v1/admin/rbac/roles', ['role_key' => 'ceo', 'status' => 'active', 'is_protected' => false])->assertStatus(422);
        $ceo = $this->account('ceo');
        $this->act($ceo)->postJson('/api/v1/admin/rbac/permissions', ['access_area_key' => 'field-cases', 'action_key' => 'read', 'status' => 'active'])->assertOk();
        $this->act($ceo)->postJson('/api/v1/admin/rbac/permissions', ['access_area_key' => 'field-cases', 'action_key' => 'approve_all', 'status' => 'inactive'])->assertOk();
        $read = DB::table('rbac_permissions')->where('action_key', 'read')->value('id');
        $inactive = DB::table('rbac_permissions')->where('action_key', 'approve_all')->value('id');

        $body = ['role_key' => 'mechanic', 'status' => 'active', 'is_protected' => true, 'description' => ' Shop floor '];
        $this->act($ceo)->postJson('/api/v1/admin/rbac/roles/update', [...$body, 'permission_ids' => [$read, $inactive]])->assertStatus(422)
            ->assertJsonPath('message', 'Only active permissions can be assigned');
        $this->act($ceo)->postJson('/api/v1/admin/rbac/roles/update', [...$body, 'permission_ids' => [$read, $read]])->assertOk();
        $page = $this->act($sa)->getJson('/api/v1/admin/rbac')->assertOk()->assertJsonPath('roles.0.permissionIds', [$read])
            ->assertJsonPath('roles.0.description', 'Shop floor')->assertJsonPath('roles.0.isProtected', true);
        $this->assertSame(['Approve All Field-Cases', 'Read Field-Cases'], collect($page->json('permissions'))->pluck('accessLabel')->sort()->values()->all());
    }

    #[Test]
    public function financing_markup_is_set_by_ceo_or_super_admin_and_audited(): void
    {
        DB::table('app_settings')->updateOrInsert(['key' => 'financing_markup_pct'], ['id' => (string) Str::uuid(), 'value' => json_encode(10), 'updated_at' => now()]);
        $this->act($this->account('account_manager'))->postJson('/api/v1/admin/settings/financing-markup', ['value' => 12])->assertStatus(403);
        $sa = $this->account('super_admin');
        $this->act($sa)->postJson('/api/v1/admin/settings/financing-markup', ['value' => 101])->assertStatus(422)->assertJsonPath('message', 'The profit cannot exceed 100%.');
        $this->act($sa)->postJson('/api/v1/admin/settings/financing-markup', ['value' => '12.345'])->assertOk()->assertJsonPath('pct', 12.35);
        $this->act($this->account('ceo'))->getJson('/api/v1/admin/settings')->assertJsonPath('financingMarkupPct', 12.35);
        $this->assertSame('Financing profit set to 12.35%', DB::table('audit_events')->where('action', 'financing_markup_updated')->value('summary'));
    }

    #[Test]
    public function only_marketing_creates_vehicles_policy_gap_1(): void
    {
        // The old RLS let any caller insert a draft vehicle. In Laravel the only writers are the Marketing
        // Specialist (staff vehicle form) and a customer's own sell submission (role:customer, tied to its transaction).
        foreach (['ceo', 'mechanic', 'head_security', 'sales_manager'] as $role) {
            $this->act($this->account($role))->postJson('/api/v1/staff/vehicles', ['make' => 'Toyota', 'model' => 'Vios', 'listing_state' => 'draft'])->assertStatus(403);
        }
        $this->act($this->account('customer'))->postJson('/api/v1/staff/vehicles', ['make' => 'Toyota'])->assertStatus(403);
        $this->act($this->account('mechanic'))->postJson('/api/v1/trading/sell', ['make' => 'Toyota'])->assertStatus(403);
        $this->assertSame(0, DB::table('vehicles')->count());
    }
}
