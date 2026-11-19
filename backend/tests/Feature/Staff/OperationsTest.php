<?php

namespace Tests\Feature\Staff;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Staff\Concerns\StaffFixtures;
use Tests\TestCase;

/** Phase 7: reports, announcements, security duty checks (policy gap 4) and the roadmap (policy gap 3). */
class OperationsTest extends TestCase
{
    use RefreshDatabase, StaffFixtures;

    #[Test]
    public function reports_are_submitted_as_the_session_user_and_reviewed_by_ceo_or_ha(): void
    {
        $am = $this->account('account_manager');
        $this->act($am)->postJson('/api/v1/staff/reports', ['report_kind' => 'sales', 'title' => 'October', 'submitted_by' => 'forged'])->assertOk();
        $this->act($this->account('head_accountant'))->postJson('/api/v1/staff/reports', ['report_kind' => 'payroll', 'title' => 'Payroll'])->assertOk();
        $this->act($am)->postJson('/api/v1/staff/reports', ['report_kind' => 'nope', 'title' => 'x'])->assertStatus(422);
        $this->assertSame($am->id, DB::table('reports')->where('title', 'October')->value('submitted_by'));

        $this->assertCount(1, $this->act($am)->getJson('/api/v1/staff/reports')->json('reports'), 'AM reads their own');
        $this->assertCount(2, $this->act($this->account('ceo'))->getJson('/api/v1/staff/reports')->json('reports'));
        $this->act($this->account('mechanic'))->getJson('/api/v1/staff/reports')->assertStatus(403);
        $id = DB::table('reports')->where('title', 'October')->value('id');
        $this->act($am)->postJson('/api/v1/staff/reports/review', ['report_id' => $id])->assertStatus(403);
        $this->act($this->account('head_accountant'))->postJson('/api/v1/staff/reports/review', ['report_id' => $id])->assertOk();
        $this->assertSame('reviewed', DB::table('reports')->where('id', $id)->value('status'));
    }

    #[Test]
    public function announcements_are_ceo_written_and_staff_read_published_unexpired(): void
    {
        $ceo = $this->account('ceo');
        $mechanic = $this->account('mechanic');
        $this->act($mechanic)->postJson('/api/v1/staff/announcements', ['title' => 'x', 'body' => 'y'])->assertStatus(403);
        $this->act($ceo)->postJson('/api/v1/staff/announcements', ['title' => 'Holiday', 'body' => 'Closed Monday'])->assertOk();
        $this->act($ceo)->postJson('/api/v1/staff/announcements', ['title' => 'Old', 'body' => 'b', 'expires_at' => now()->subDay()->toIso8601String()])->assertOk();
        $this->assertCount(0, $this->act($mechanic)->getJson('/api/v1/staff/announcements')->json('announcements'), 'drafts are hidden');
        foreach (DB::table('announcements')->pluck('id') as $id) {
            $this->act($ceo)->postJson('/api/v1/staff/announcements/published', ['announcement_id' => $id])->assertOk();
        }
        $this->assertSame(['Holiday'], array_column($this->act($mechanic)->getJson('/api/v1/staff/announcements')->json('announcements'), 'title'));
        $this->assertCount(2, $this->act($ceo)->getJson('/api/v1/staff/announcements')->json('announcements'));
        $this->act($this->account('customer'))->getJson('/api/v1/staff/announcements')->assertStatus(403);
    }

    #[Test]
    public function security_duty_checks_are_head_security_own_and_ceo_read_only(): void
    {
        Storage::fake('local');
        $hs = $this->account('head_security');
        $this->act($hs)->postJson('/api/v1/staff/security-duty-checks', ['duty_date' => '2026-11-23'])->assertOk();
        $this->act($hs)->postJson('/api/v1/staff/security-duty-checks', ['duty_date' => '2026-11-23'])->assertStatus(409);
        $id = DB::table('security_duty_checks')->value('id');
        $this->act($hs)->postJson('/api/v1/staff/security-duty-checks/complete', ['duty_check_id' => $id])->assertStatus(422)
            ->assertJsonPath('message', 'Both before and after images are required to complete the check.');
        foreach (['before', 'after'] as $slot) {
            $this->act($hs)->post('/api/v1/staff/security-duty-checks/evidence', ['duty_check_id' => $id, 'slot' => $slot, 'image' => UploadedFile::fake()->image("{$slot}.jpg")])->assertOk();
        }
        $this->act($hs)->postJson('/api/v1/staff/security-duty-checks/complete', ['duty_check_id' => $id, 'notes' => 'All clear'])->assertOk();
        $this->assertSame('completed', DB::table('security_duty_checks')->where('id', $id)->value('status'));
        $this->assertStringStartsWith($hs->id.'/', DB::table('security_duty_checks')->where('id', $id)->value('before_image_path'));

        // Gap 4: another role cannot write a check even for its own id, and cannot read the list.
        $mechanic = $this->account('mechanic');
        $this->act($mechanic)->postJson('/api/v1/staff/security-duty-checks', ['duty_date' => '2026-11-24'])->assertStatus(403);
        $this->act($mechanic)->getJson('/api/v1/staff/security-duty-checks')->assertStatus(403);
        $this->act($this->account('ceo'))->postJson('/api/v1/staff/security-duty-checks', ['duty_date' => '2026-11-24'])->assertStatus(403);
        $this->assertCount(1, $this->act($this->account('ceo'))->getJson('/api/v1/staff/security-duty-checks')->assertJsonPath('canManage', false)->json('checks'));
        // Another Head Security account sees none of these.
        $this->assertCount(0, $this->act($this->account('head_security'))->getJson('/api/v1/staff/security-duty-checks')->json('checks'));
    }

    #[Test]
    public function roadmap_is_closed_to_customers_and_written_by_the_ceo(): void
    {
        $ceo = $this->account('ceo');
        $initiative = $this->act($ceo)->postJson('/api/v1/staff/roadmap', ['kind' => 'initiative', 'title' => 'Showroom 2', 'status' => 'planned', 'priority' => 'high'])
            ->assertOk()->json('id');
        $this->act($ceo)->postJson('/api/v1/staff/roadmap', ['kind' => 'epic', 'title' => 'No parent', 'status' => 'planned', 'priority' => 'low'])->assertStatus(422)
            ->assertJsonPath('message', 'Initiatives cannot have a parent; epics and features require one.');
        $this->act($ceo)->postJson('/api/v1/staff/roadmap', ['kind' => 'epic', 'parent_id' => $initiative, 'title' => 'Lease', 'status' => 'planned', 'priority' => 'low', 'year' => 2027])->assertOk();
        $this->act($this->account('sales_manager'))->getJson("/api/v1/staff/roadmap/{$initiative}")->assertOk()->assertJsonCount(1, 'children');
        $this->act($this->account('account_manager'))->postJson('/api/v1/staff/roadmap', ['kind' => 'initiative', 'title' => 'x', 'status' => 'planned', 'priority' => 'low'])->assertStatus(403);

        // Gap 3: customers (and staff outside the page's readers) cannot read it.
        $this->act($this->account('customer'))->getJson('/api/v1/staff/roadmap')->assertStatus(403);
        $this->act($this->account('mechanic'))->getJson('/api/v1/staff/roadmap')->assertStatus(403);
        $this->assertCount(2, $this->act($this->account('account_manager'))->getJson('/api/v1/staff/roadmap')->json('items'));

        $this->act($ceo)->postJson('/api/v1/staff/roadmap/update', ['id' => $initiative, 'kind' => 'initiative', 'title' => 'Showroom Two', 'status' => 'in_progress', 'priority' => 'high'])->assertOk();
        $this->assertSame('Showroom Two', DB::table('roadmap_items')->where('id', $initiative)->value('title'));
    }

    #[Test]
    public function dashboard_scopes_money_and_operations_and_sends_nothing(): void
    {
        $this->act($this->account('ceo'))->getJson('/api/v1/staff/dashboard')->assertOk()
            ->assertJsonPath('role', 'ceo')->assertJsonPath('operations.pendingRuns', 0)->assertJsonPath('revenue', []);
        $this->act($this->account('mechanic'))->getJson('/api/v1/staff/dashboard')->assertOk()
            ->assertJsonPath('revenue', null)->assertJsonPath('operations', null);
        $this->act($this->account('head_security'))->getJson('/api/v1/staff/dashboard')->assertOk()->assertJsonPath('reconditioning', []);
        $this->act($this->account('super_admin'))->getJson('/api/v1/staff/dashboard')->assertStatus(403);
        $this->act($this->account('customer'))->getJson('/api/v1/staff/dashboard')->assertStatus(403);
        $this->assertSame(0, DB::table('notifications')->count(), 'opening the dashboard sends no notices');
        $this->act($this->account('sales_manager'))->getJson('/api/v1/staff/insights')->assertOk()->assertJsonStructure(['vehicles', 'favourites', 'inquiries', 'completedBuys', 'purchases']);
        $this->act($this->account('mechanic'))->getJson('/api/v1/staff/insights')->assertStatus(403);
    }
}
