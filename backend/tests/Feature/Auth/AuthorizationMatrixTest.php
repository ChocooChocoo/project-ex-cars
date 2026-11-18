<?php

namespace Tests\Feature\Auth;

use App\Enums\Role;
use App\Models\AppSetting;
use App\Models\FieldCase;
use App\Models\Inquiry;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Vehicle;
use App\Models\VehiclePriceProposal;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Auth\Concerns\MakesAccounts;
use Tests\TestCase;

/** Every rule is checked for all ten roles, through the API or the Gate, never through hidden navigation. */
class AuthorizationMatrixTest extends TestCase
{
    use MakesAccounts, RefreshDatabase;

    /** @var array<string, User> */
    private array $users = [];

    protected function setUp(): void
    {
        parent::setUp();
        foreach (Role::values() as $role) {
            $this->users[$role] = $this->account($role);
        }
    }

    private function allowedFor(callable $check): array
    {
        return array_keys(array_filter($this->users, $check));
    }

    #[Test]
    public function admin_endpoints_by_role(): void
    {
        $target = $this->account('customer');
        $cases = [
            ['admin/roles', ['account_id' => $target->id, 'role' => 'customer'], ['ceo', 'super_admin']],
            ['admin/accounts/walk-in', fn () => ['full_name' => 'Walk In', 'email' => Str::random(8).'@test.local', 'password' => 'Secret#123'], ['ceo', 'account_manager']],
            ['admin/accounts/employee', fn () => ['full_name' => 'New Hire', 'email' => Str::random(8).'@test.local', 'password' => 'Secret#123', 'role' => 'mechanic'], ['ceo', 'account_manager']],
            ['me/email', fn () => ['email' => Str::random(8).'@test.local'], ['customer']],
        ];
        foreach ($cases as [$path, $body, $expected]) {
            $allowed = [];
            foreach ($this->users as $role => $user) {
                $status = $this->as($user)->postJson("/api/v1/{$path}", is_callable($body) ? $body() : $body)->status();
                if ($status < 300) {
                    $allowed[] = $role;
                } else {
                    $this->assertSame(403, $status, "{$role} on {$path}");
                }
            }
            $this->assertEqualsCanonicalizing($expected, $allowed, $path);
        }
    }

    #[Test]
    public function the_actor_comes_from_the_session_not_the_request(): void
    {
        $target = $this->account('customer');
        $this->as($this->users['ceo'])
            ->postJson('/api/v1/admin/roles', ['account_id' => $target->id, 'role' => 'mechanic', 'assigned_by' => $this->users['customer']->id])->assertOk();

        $this->assertSame($this->users['ceo']->id, DB::table('user_roles')->where('account_id', $target->id)->value('assigned_by'));
        $this->assertSame($this->users['ceo']->id, DB::table('audit_events')->where('record_id', $target->id)->value('actor_id'));
    }

    #[Test]
    public function new_employee_accounts_get_role_profile_schedule_and_audit_atomically(): void
    {
        $this->as($this->users['account_manager'])
            ->postJson('/api/v1/admin/accounts/employee', ['full_name' => 'New Hire', 'email' => 'hire@test.local', 'password' => 'Secret#123', 'role' => 'mechanic'])->assertCreated();
        $hire = User::query()->where('email', 'hire@test.local')->firstOrFail();
        $this->assertSame('mechanic', $hire->role()->value);
        $this->assertTrue(DB::table('employee_work_schedules')->where('employee_id', $hire->id)->exists());
        $this->assertSame('employee_account_created', DB::table('audit_events')->where('record_id', $hire->id)->value('action'));

        $this->postJson('/api/v1/admin/accounts/employee', ['full_name' => 'Boss', 'email' => 'boss@test.local', 'password' => 'Secret#123', 'role' => 'ceo'])
            ->assertStatus(422)->assertJsonPath('message', 'Choose a staff role.');
    }

    #[Test]
    public function transactions_customer_ownership_staff_viewers_and_drafts(): void
    {
        $customer = $this->users['customer'];
        $other = $this->account('customer');
        $mine = $this->transaction($customer, 'buy', ['flow_status' => 'pending_sm_approval']);
        $theirs = $this->transaction($other, 'buy', ['flow_status' => 'pending_sm_approval']);
        $sell = $this->transaction($other, 'sell', ['current_state' => 'under_review']);
        $draft = $this->transaction($other, 'buy');

        $this->assertTrue(Gate::forUser($customer)->allows('view', $mine));
        $this->assertFalse(Gate::forUser($customer)->allows('view', $theirs), 'cross-customer id');
        $this->assertEqualsCanonicalizing(['customer', 'ceo', 'account_manager', 'head_accountant', 'confidential_informant', 'sales_manager'],
            $this->allowedFor(fn ($u) => Gate::forUser($u)->allows('view', $u->hasRole('customer') ? $mine : $theirs)));
        $this->assertContains('marketing_specialist', $this->allowedFor(fn ($u) => Gate::forUser($u)->allows('view', $sell)));
        $this->assertSame([], $this->allowedFor(fn ($u) => Gate::forUser($u)->allows('view', $draft)), 'unsubmitted buy drafts are hidden from staff');
        $this->assertEqualsCanonicalizing(['ceo', 'account_manager', 'head_accountant', 'sales_manager'],
            $this->allowedFor(fn ($u) => ! $u->hasRole('customer') && Gate::forUser($u)->allows('update', $theirs)));
    }

    #[Test]
    public function inquiries_by_role_and_assignment(): void
    {
        $buy = $this->inquiry('buy_now');
        $plain = $this->inquiry('inquiry');
        $this->assertEqualsCanonicalizing(['customer', 'ceo', 'account_manager', 'sales_manager'], $this->allowedFor(fn ($u) => Gate::forUser($u)->allows('view', $buy)));
        $this->assertEqualsCanonicalizing(['customer', 'ceo', 'account_manager'], $this->allowedFor(fn ($u) => Gate::forUser($u)->allows('view', $plain)));

        $buy->forceFill(['assigned_sales_manager' => $this->account('sales_manager')->id])->save();
        $this->assertFalse(Gate::forUser($this->users['sales_manager'])->allows('update', $buy), 'another SM owns it');
        $this->assertTrue(Gate::forUser($this->users['account_manager'])->allows('update', $buy), 'AM may still claim (no AM assigned)');
    }

    #[Test]
    public function field_cases_follow_assignment(): void
    {
        $case = new FieldCase;
        $case->forceFill(['case_kind' => 'recovery', 'assigned_confidential_informant' => $this->users['confidential_informant']->id, 'head_security_id' => $this->users['head_security']->id])->save();
        $this->assertEqualsCanonicalizing(['ceo', 'sales_manager', 'head_accountant', 'confidential_informant', 'head_security'], $this->allowedFor(fn ($u) => Gate::forUser($u)->allows('view', $case)));
        $this->assertEqualsCanonicalizing(['ceo', 'sales_manager', 'confidential_informant', 'head_security'], $this->allowedFor(fn ($u) => Gate::forUser($u)->allows('update', $case)));
        $this->assertFalse(Gate::forUser($this->account('confidential_informant'))->allows('view', $case), 'an unassigned CI');
        $this->assertEqualsCanonicalizing(['ceo', 'sales_manager'], $this->allowedFor(fn ($u) => Gate::forUser($u)->allows('assign', FieldCase::class)));
    }

    #[Test]
    public function compensation_privacy_approval_roles_and_super_admin_limits(): void
    {
        $this->assertEqualsCanonicalizing(['ceo', 'account_manager', 'head_accountant'], $this->allowedFor(fn ($u) => Gate::forUser($u)->allows('viewAny', \App\Models\StaffCompensation::class)));
        $this->assertEqualsCanonicalizing(['ceo', 'account_manager'], $this->allowedFor(fn ($u) => Gate::forUser($u)->allows('create', \App\Models\StaffCompensation::class)));

        $proposal = new VehiclePriceProposal;
        $proposal->forceFill(['decision' => 'pending']);
        $this->assertSame(['ceo'], $this->allowedFor(fn ($u) => Gate::forUser($u)->allows('decide', $proposal)));
        $this->assertSame(['marketing_specialist'], $this->allowedFor(fn ($u) => Gate::forUser($u)->allows('create', VehiclePriceProposal::class)));

        $this->assertEqualsCanonicalizing(['ceo', 'super_admin'], $this->allowedFor(fn ($u) => Gate::forUser($u)->allows('update', AppSetting::class)));

        // Super Admin manages accounts and settings but reads no business data.
        $admin = $this->users['super_admin'];
        foreach ([$this->transaction($this->users['customer'], 'buy', ['flow_status' => 'sold']), $this->inquiry('inquiry'), $this->fieldCase()] as $record) {
            $this->assertFalse(Gate::forUser($admin)->allows('view', $record), class_basename($record));
        }
        $this->assertFalse(Gate::forUser($admin)->allows('viewAny', \App\Models\StaffCompensation::class));
    }

    private function transaction(User $customer, string $kind, array $extra = []): Transaction
    {
        $tx = new Transaction;
        $tx->forceFill(['customer_id' => $customer->id, 'created_by' => $customer->id, 'transaction_kind' => $kind] + $extra)->save();

        return $tx->fresh();
    }

    private function inquiry(string $kind): Inquiry
    {
        $vehicle = new Vehicle;
        $vehicle->forceFill(['stock_code' => Str::random(8), 'make' => 'Toyota', 'model' => 'Vios', 'year' => 2021])->save();
        $inquiry = new Inquiry;
        $inquiry->forceFill(['customer_id' => $this->users['customer']->id, 'vehicle_id' => $vehicle->id, 'intention_kind' => $kind])->save();

        return $inquiry->fresh();
    }

    private function fieldCase(): FieldCase
    {
        $case = new FieldCase;
        $case->forceFill(['case_kind' => 'acquisition'])->save();

        return $case->fresh();
    }
}
