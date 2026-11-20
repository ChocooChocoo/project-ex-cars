<?php

namespace Tests\Feature\Trading;

use App\Models\User;
use App\Services\Finance\PaymentRules;
use App\Services\Trading\BuyRules;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Trading\Concerns\TradingFixtures;
use Tests\TestCase;

/**
 * Plan Phase 10: the seller's original papers (SN-3 / SN-4 / BC-5 / BC-7), the GCE-visit payment before signing
 * (BC-4) and the financing-only Policy & Warranty (BC-6).
 */
class PapersCustodyTest extends TestCase
{
    use RefreshDatabase, TradingFixtures;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
    }

    /** A sell offer GCE has paid for, on a car of its own. @return array{tx: string, vehicle: string, seller: User} */
    private function boughtCar(string $state = 'completed'): array
    {
        $seller = $this->customer();
        $vehicle = $this->vehicle(450000);
        $tx = (string) Str::uuid();
        DB::table('transactions')->insert(['id' => $tx, 'customer_id' => $seller->id, 'created_by' => $seller->id, 'transaction_kind' => 'sell',
            'vehicle_id' => $vehicle, 'current_state' => $state, 'opened_at' => now()->subDays(20), 'created_at' => now(), 'updated_at' => now()]);

        return ['tx' => $tx, 'vehicle' => $vehicle, 'seller' => $seller];
    }

    private function capture(User $user, string $tx, array $extra = []): \Illuminate\Testing\TestResponse
    {
        return $this->act($user)->post('/api/v1/staff/trading/sell/capture-papers', [
            'transaction_id' => $tx,
            'official_receipt' => UploadedFile::fake()->image('or.jpg'),
            'certificate_of_registration' => UploadedFile::fake()->image('cr.jpg'),
            'deed_of_sale' => UploadedFile::fake()->image('deed.jpg'),
        ] + $extra);
    }

    #[Test]
    public function the_marketing_specialist_sends_the_papers_and_their_custody_follows_the_buyers_sale(): void
    {
        $car = $this->boughtCar();
        $ms = $this->account('marketing_specialist');
        $ci = $this->account('confidential_informant');
        $sm = $this->account('sales_manager');

        $this->capture($this->account('mechanic'), $car['tx'])->assertForbidden();
        $waiting = $this->boughtCar('approved');
        $this->capture($ms, $waiting['tx'])->assertStatus(422)->assertJson(['message' => 'Capture the papers after GCE has paid the seller.']);
        $this->act($ms)->post('/api/v1/staff/trading/sell/capture-papers', ['transaction_id' => $car['tx'], 'official_receipt' => UploadedFile::fake()->image('or.jpg')])
            ->assertStatus(422);

        $this->capture($ms, $car['tx'], ['extra' => [UploadedFile::fake()->image('page2.jpg')]])->assertOk();
        $items = DB::table('vehicle_document_items')->where('vehicle_id', $car['vehicle'])->get();
        $this->assertEqualsCanonicalizing(['official_receipt', 'certificate_of_registration', 'deed_of_sale'], $items->pluck('document_kind')->all());
        $this->assertSame(['with_ci'], $items->pluck('custody_state')->unique()->values()->all());
        $this->assertSame([$car['tx']], $items->pluck('source_transaction_id')->unique()->values()->all());
        $this->assertSame(4, DB::table('transaction_documents')->where('transaction_id', $car['tx'])->where('verification_state', 'verified')->count());
        $this->assertSame(1, DB::table('notifications')->where('kind', 'vehicle_papers_received')->count());
        $this->capture($ms, $car['tx'])->assertStatus(409);

        // SN-4: the CI's "From sellers" list, with the seller and one link per paper.
        $list = $this->act($ci)->getJson('/api/v1/staff/vehicle-papers')->assertOk()->json('fromSellers');
        $this->assertCount(1, $list);
        $this->assertSame('with_ci', $list[0]['custody_state']);
        $this->assertSame($car['tx'], $list[0]['source_transaction_id']);
        $this->assertSame(['official_receipt', 'certificate_of_registration', 'deed_of_sale'], array_column($list[0]['papers'], 'document_kind'));
        $this->assertNotNull($list[0]['papers'][0]['url']);

        // BC-7: the Sales Manager opens the previous owner's papers from a buy request for the same car.
        $buyer = $this->customer();
        $buy = $this->buyRequest($buyer, $car['vehicle'], 'cash', 'gce_visit', null, ['current_state' => 'approved']);
        $this->act($ms)->getJson("/api/v1/staff/transactions/{$buy}/car-papers")->assertForbidden();
        $papers = $this->act($sm)->getJson("/api/v1/staff/transactions/{$buy}/car-papers")->assertOk();
        $papers->assertJsonPath('custodyState', 'with_ci')->assertJsonCount(4, 'documents');

        // BC-4: a full-cash GCE visit requests the papers with no verified payment; the CI's release marks them Released.
        $this->act($sm)->postJson('/api/v1/staff/trading/handover/request-papers-release', ['transaction_id' => $buy])->assertOk();
        $this->act($ci)->postJson('/api/v1/staff/trading/handover/approve-papers-release', ['transaction_id' => $buy])->assertOk();
        $this->assertSame(['released'], DB::table('vehicle_document_items')->where('vehicle_id', $car['vehicle'])->pluck('custody_state')->unique()->values()->all());
    }

    #[Test]
    public function papers_returned_by_an_unsuccessful_sale_are_on_hold(): void
    {
        $car = $this->boughtCar();
        $this->capture($this->account('marketing_specialist'), $car['tx'])->assertOk();
        $buy = $this->buyRequest($this->customer(), $car['vehicle'], 'financing', 'gce_visit', null, ['current_state' => 'approved']);
        DB::table('sale_handovers')->insert(['transaction_id' => $buy, 'papers_status' => 'requested']);

        $this->act($this->account('sales_manager'))->postJson('/api/v1/staff/trading/buyer-decline', ['transaction_id' => $buy, 'reason' => 'Changed mind'])->assertOk();
        $this->assertSame('returned', DB::table('sale_handovers')->where('transaction_id', $buy)->value('papers_status'));
        $this->assertSame(['on_hold'], DB::table('vehicle_document_items')->where('vehicle_id', $car['vehicle'])->pluck('custody_state')->unique()->values()->all());
    }

    #[Test]
    public function a_gce_visit_is_paid_before_signing_and_only_financing_has_a_policy_and_warranty(): void
    {
        $sm = $this->account('sales_manager');
        $cash = $this->buyRequest($this->customer(), $this->vehicle(), 'cash', 'gce_visit', null, ['current_state' => 'approved']);
        $financed = $this->buyRequest($this->customer(), $this->vehicle(), 'financing', 'gce_visit', null, ['current_state' => 'approved']);

        $this->act($sm)->getJson("/api/v1/papers/{$cash}/policy-warranty")->assertNotFound();
        $this->act($sm)->getJson("/api/v1/papers/{$financed}/policy-warranty")->assertOk()
            ->assertJsonPath('signatures.gceRole', 'Sales Manager')->assertJsonPath('signatures.gceUrl', null);
        $this->act($sm)->getJson("/api/v1/papers/{$cash}/deed-of-sale")->assertOk()->assertJsonPath('signatures.buyerUrl', null);

        // BC-2: a cash GCE visit now has a contract, but its full payment is still taken at the office before signing.
        $this->assertTrue(BuyRules::needsContract(DB::table('purchase_details')->where('transaction_id', $cash)->first()));
        $this->assertTrue(PaymentRules::allowedBeforeSigning(DB::table('purchase_details')->where('transaction_id', $cash)->first(), 'full'));
        $this->assertFalse(PaymentRules::allowedBeforeSigning(DB::table('purchase_details')->where('transaction_id', $financed)->first(), 'downpayment'));
    }
}
