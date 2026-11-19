<?php

namespace Tests\Feature\Staff;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Staff\Concerns\StaffFixtures;
use Tests\TestCase;

/** Phase 7: employee requests (was the employee-requests Server Actions and the deleted actions.test.ts). */
class EmployeeRequestTest extends TestCase
{
    use RefreshDatabase, StaffFixtures;

    #[Test]
    public function employees_file_requests_with_proofs_and_rules(): void
    {
        Storage::fake('local');
        $mechanic = $this->account('mechanic');
        $this->act($mechanic)->post('/api/v1/staff/employee-requests', [
            'request_kind' => 'leave', 'start_date' => '2026-11-24', 'end_date' => '2026-11-25', 'leave_reason' => 'sick',
            'proofs' => [UploadedFile::fake()->image('note.jpg')], 'employee_id' => 'forged',
        ])->assertOk();
        $request = DB::table('employee_requests')->first();
        $this->assertSame($mechanic->id, $request->employee_id);
        $this->assertSame('pending', $request->status);
        $attachment = DB::table('employee_request_attachments')->first();
        $this->assertStringStartsWith($mechanic->id.'/', $attachment->storage_path);
        $this->assertSame('image', $attachment->file_kind);

        $this->act($mechanic)->postJson('/api/v1/staff/employee-requests', ['request_kind' => 'overtime', 'start_date' => '2026-11-24', 'overtime_hours' => 13])
            ->assertStatus(422)->assertJsonPath('message', 'Enter at most 12 hours.');
        $this->act($mechanic)->postJson('/api/v1/staff/employee-requests', ['request_kind' => 'leave', 'start_date' => '2026-11-24', 'leave_reason' => 'others'])
            ->assertStatus(422)->assertJsonPath('message', 'Describe the reason for the leave.');
        $this->act($mechanic)->postJson('/api/v1/staff/employee-requests', ['request_kind' => 'other', 'start_date' => '2026-11-24'])
            ->assertStatus(422)->assertJsonPath('message', 'Reason is required.');
        $this->act($mechanic)->postJson('/api/v1/staff/employee-requests', ['request_kind' => 'overtime', 'start_date' => '2026-11-24', 'overtime_hours' => 2, 'end_date' => '2026-11-30'])->assertOk();
        $this->assertNull(DB::table('employee_requests')->where('request_kind', 'overtime')->value('end_date'));
        $this->act($mechanic)->post('/api/v1/staff/employee-requests', ['request_kind' => 'other', 'start_date' => '2026-11-24', 'reason' => 'x',
            'proofs' => [UploadedFile::fake()->create('a.txt', 1, 'text/plain')]], ['Accept' => 'application/json'])->assertStatus(422);
        $this->assertSame(2, DB::table('employee_requests')->count(), 'a refused proof saves no request');
    }

    #[Test]
    public function only_ceo_or_am_decide_and_employees_see_and_cancel_their_own(): void
    {
        Storage::fake('local');
        $mechanic = $this->account('mechanic');
        $other = $this->account('sales_manager');
        foreach ([$mechanic, $other] as $who) {
            $this->act($who)->postJson('/api/v1/staff/employee-requests', ['request_kind' => 'other', 'start_date' => '2026-11-24', 'reason' => 'x'])->assertOk();
        }
        $mine = DB::table('employee_requests')->where('employee_id', $mechanic->id)->value('id');
        $theirs = DB::table('employee_requests')->where('employee_id', $other->id)->value('id');

        $this->assertCount(1, $this->act($mechanic)->getJson('/api/v1/staff/employee-requests')->json('requests'));
        $this->assertCount(2, $this->act($this->account('account_manager'))->getJson('/api/v1/staff/employee-requests')->json('requests'));

        $this->act($mechanic)->postJson('/api/v1/staff/employee-requests/cancel', ['request_id' => $theirs])->assertOk();
        $this->assertSame('pending', DB::table('employee_requests')->where('id', $theirs)->value('status'), 'cannot cancel someone else\'s');
        $this->act($mechanic)->postJson('/api/v1/staff/employee-requests/review', ['request_id' => $mine, 'decision' => 'approved'])->assertStatus(403);
        $this->act($this->account('head_accountant'))->postJson('/api/v1/staff/employee-requests/review', ['request_id' => $mine, 'decision' => 'approved'])->assertStatus(403);

        $ceo = $this->account('ceo');
        $this->act($ceo)->postJson('/api/v1/staff/employee-requests/review', ['request_id' => $mine, 'decision' => 'approved', 'review_notes' => 'ok'])->assertOk();
        $row = DB::table('employee_requests')->where('id', $mine)->first();
        $this->assertSame(['approved', $ceo->id], [$row->status, $row->reviewed_by]);
        $this->act($mechanic)->postJson('/api/v1/staff/employee-requests/cancel', ['request_id' => $mine])->assertOk();
        $this->assertSame('approved', DB::table('employee_requests')->where('id', $mine)->value('status'), 'a decided request cannot be cancelled');
    }
}
