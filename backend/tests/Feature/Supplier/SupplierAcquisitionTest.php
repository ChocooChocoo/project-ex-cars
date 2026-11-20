<?php

namespace Tests\Feature\Supplier;

use App\Models\User;
use App\Services\Trading\Trading;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Trading\Concerns\TradingFixtures;
use Tests\TestCase;

/** Process & Revision Notes Phase 3: an approved supplier vehicle is bought through the sell pipeline. */
class SupplierAcquisitionTest extends TestCase
{
    use RefreshDatabase, TradingFixtures;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        Notification::fake();
    }

    /** @return array{supplier: User, post: string, ms: User} An approved post at a market value of ₱450,000. */
    private function approvedPost(): array
    {
        $email = uniqid('supplier').'@gmail.com';
        $this->act($this->account('account_manager'))->postJson('/api/v1/admin/accounts/supplier', [
            'full_name' => 'Juan Dela Cruz', 'email' => $email, 'company_name' => 'Cavite Auto Supply',
        ])->assertCreated();
        $supplier = User::query()->where('email', $email)->firstOrFail();
        $post = $this->act($supplier)->post('/api/v1/supplier/posts', [
            'make' => 'Toyota', 'model' => 'Vios', 'year' => 2019, 'mileage' => 45000, 'asking_price' => 480000,
            'photos' => [UploadedFile::fake()->image('front.jpg')],
        ])->assertCreated()->json('id');
        $ms = $this->account('marketing_specialist');
        $this->act($ms)->postJson("/api/v1/staff/supplier-posts/{$post}/propose", ['market_value' => 450000, 'reason' => 'Sells fast'])->assertOk();
        $this->act($this->account('ceo'))->postJson("/api/v1/staff/supplier-posts/{$post}/decide", ['decision' => 'approved'])->assertOk();

        return ['supplier' => $supplier, 'post' => $post, 'ms' => $ms];
    }

    private function assignBody(User $ci, User $mechanic, array $override = []): array
    {
        return $override + ['informant_id' => $ci->id, 'mechanic_id' => $mechanic->id, 'schedule' => $this->slot(3)->toIso8601String(),
            'location' => 'Lot 4, Salitran, Dasmariñas, Cavite', 'agreed_price' => 440000];
    }

    #[Test]
    public function assigning_opens_one_sell_purchase_and_paying_marks_the_post_purchased(): void
    {
        ['supplier' => $supplier, 'post' => $post, 'ms' => $ms] = $this->approvedPost();
        $ci = $this->account('confidential_informant');
        $mechanic = $this->account('mechanic');

        $this->act($ms)->postJson("/api/v1/staff/supplier-posts/{$post}/assign", $this->assignBody($ci, $mechanic, ['agreed_price' => 460000]))
            ->assertStatus(422)->assertJson(['message' => 'The agreed price must stay within the approved market value.']);
        $tx = $this->act($ms)->postJson("/api/v1/staff/supplier-posts/{$post}/assign", $this->assignBody($ci, $mechanic))->assertOk()->json('transaction_id');
        // A retry opens nothing new.
        $this->act($ms)->postJson("/api/v1/staff/supplier-posts/{$post}/assign", $this->assignBody($ci, $mechanic))->assertStatus(409);
        $this->assertSame(1, DB::table('transactions')->where('customer_id', $supplier->id)->count());

        $sell = DB::table('transactions')->where('id', $tx)->first();
        $this->assertSame(['sell', 'approved'], [$sell->transaction_kind, $sell->current_state]);
        $this->assertSame('draft', DB::table('vehicles')->where('id', $sell->vehicle_id)->value('listing_state'));
        $case = DB::table('field_cases')->where('transaction_id', $tx)->first();
        $this->assertSame(['acquisition', $ci->id, $mechanic->id], [$case->case_kind, $case->assigned_confidential_informant, $case->mechanic_id]);
        $this->assertSame('assigned', DB::table('supplier_vehicle_posts')->where('id', $post)->value('state'));

        // The CI requests the car payment (Meet Halfway path), the Head Accountant releases it, the car is cleared.
        $this->act($ci)->postJson('/api/v1/staff/finance/request-purchase-funds', ['transaction_id' => $tx])->assertOk();
        $fund = DB::table('disbursement_requests')->where('purchase_transaction_id', $tx)->value('id');
        $this->assertSame(44_000_000, (int) DB::table('disbursement_requests')->where('id', $fund)->value('amount_cents'));
        $this->act($this->account('head_accountant'))->postJson('/api/v1/staff/finance/advance', ['disbursement_id' => $fund, 'event_kind' => 'approve_release'])->assertOk();
        DB::table('sell_details')->where('transaction_id', $tx)->update(['cleared_for_payment_at' => now()]);

        $this->act($ci)->postJson('/api/v1/staff/finance/record-seller-paid', ['disbursement_id' => $fund])->assertOk();
        $this->again()->postJson('/api/v1/staff/finance/record-seller-paid', ['disbursement_id' => $fund])->assertOk();
        $this->assertSame(1, DB::table('financial_entries')->where('idempotency_key', 'release:'.$fund)->count());
        $this->assertSame(1, DB::table('vehicles')->where('id', $sell->vehicle_id)->count());
        // A no-issue car goes to pricing and posting; the post leaves the supplier's active list.
        $this->assertSame('awaiting_price_approval', DB::table('vehicles')->where('id', $sell->vehicle_id)->value('listing_state'));
        $this->assertSame('purchased', DB::table('supplier_vehicle_posts')->where('id', $post)->value('state'));
        $this->act($supplier)->getJson('/api/v1/supplier/dashboard')->assertOk()
            ->assertJsonPath('counts.purchased', 1)->assertJsonPath('counts.posted', 0)->assertJsonPath('counts.transactions', 1);
    }

    #[Test]
    public function only_an_approved_post_can_be_assigned_and_a_cancelled_purchase_rejects_the_post(): void
    {
        ['post' => $post, 'ms' => $ms] = $this->approvedPost();
        $ci = $this->account('confidential_informant');
        $mechanic = $this->account('mechanic');
        $this->act($this->account('ceo'))->postJson("/api/v1/staff/supplier-posts/{$post}/assign", $this->assignBody($ci, $mechanic))->assertForbidden();
        $this->act($ms)->postJson("/api/v1/staff/supplier-posts/{$post}/assign", $this->assignBody($mechanic, $mechanic))->assertStatus(422);

        $tx = $this->act($ms)->postJson("/api/v1/staff/supplier-posts/{$post}/assign", $this->assignBody($ci, $mechanic))->assertOk()->json('transaction_id');
        Trading::updateTx($tx, ['current_state' => 'cancelled', 'completed_at' => now()], 'approved');
        $this->assertSame('rejected', DB::table('supplier_vehicle_posts')->where('id', $post)->value('state'));
    }
}
