<?php

namespace Tests\Feature\Trading;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Trading\Concerns\TradingFixtures;
use Tests\TestCase;

/**
 * Plan Phase 4 (SH-10): a customer only ever receives their own customer-facing documents. The meet-up expense
 * proofs the Confidential Informant files and the Mechanic's inspection photos are staff-only, so the server
 * filters them out of the customer's own transaction before answering.
 */
class DocumentAudienceTest extends TestCase
{
    use RefreshDatabase, TradingFixtures;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
    }

    /** One document row on a transaction, with its own storage key. */
    private function document(string $transactionId, string $uploader, string $kind, string $state = 'verified'): string
    {
        $id = (string) Str::uuid();
        DB::table('transaction_documents')->insert([
            'id' => $id, 'transaction_id' => $transactionId, 'document_kind' => $kind,
            'storage_path' => "{$transactionId}/{$kind}-".Str::random(6).'.jpg', 'uploader_id' => $uploader,
            'verification_state' => $state, 'upload_date' => now(),
        ]);

        return $id;
    }

    /** A sell offer owned by $seller, with its details. */
    private function sellOffer(\App\Models\User $seller): string
    {
        $id = (string) Str::uuid();
        DB::table('transactions')->insert([
            'id' => $id, 'customer_id' => $seller->id, 'created_by' => $seller->id, 'transaction_kind' => 'sell',
            'vehicle_id' => $this->vehicle(), 'current_state' => 'pending', 'opened_at' => now(), 'created_at' => now(), 'updated_at' => now(),
        ]);
        DB::table('sell_details')->insert([
            'id' => (string) Str::uuid(), 'transaction_id' => $id, 'offered_amount' => 500000,
            'papers_checklist' => json_encode(['official_receipt' => 'has', 'certificate_of_registration' => 'has', 'deed_of_sale' => 'has']),
            'created_at' => now(), 'updated_at' => now(),
        ]);

        return $id;
    }

    #[Test]
    public function a_sellers_response_carries_no_expense_proof_or_inspection_photo(): void
    {
        $seller = $this->customer();
        $ci = $this->account('confidential_informant');
        $id = $this->sellOffer($seller);
        $this->document($id, $seller->id, 'valid_id');
        $this->document($id, $seller->id, 'sell_photo');
        // The CI files the meet-up receipts and the Mechanic the inspection photos against the same transaction.
        $this->document($id, $ci->id, 'expense_proof');
        $this->document($id, $ci->id, 'inspection_photo');

        $response = $this->act($seller)->getJson("/api/v1/my-transactions/{$id}")->assertOk();
        $kinds = collect($response->json('documents'))->pluck('document_kind');

        $this->assertTrue($kinds->contains('valid_id'), 'the seller still reads their own ID');
        $this->assertTrue($kinds->contains('sell_photo'), 'the seller still reads their own photos');
        $this->assertFalse($kinds->contains('expense_proof'), 'SH-10: expense proofs never reach a customer');
        $this->assertFalse($kinds->contains('inspection_photo'), 'SH-10: inspection photos never reach a customer');
        // The staff screen still sees both, so the filter is an audience rule and not a deletion.
        $this->assertSame(1, DB::table('transaction_documents')->where('transaction_id', $id)->where('document_kind', 'expense_proof')->count());
    }

    #[Test]
    public function a_buyer_never_receives_another_sales_ci_papers(): void
    {
        $buyer = $this->customer();
        $otherBuyer = $this->customer();
        $ci = $this->account('confidential_informant');
        $own = $this->buyRequest($buyer, $this->vehicle(), 'cash', 'delivery');
        $foreign = $this->buyRequest($otherBuyer, $this->vehicle(), 'cash', 'delivery');
        $this->document($own, $buyer->id, 'valid_id');
        // A handover paper the CI filed on the other buyer's sale.
        $this->document($foreign, $ci->id, 'sale_document');
        $this->document($foreign, $ci->id, 'expense_proof');

        $kinds = collect($this->act($buyer)->getJson("/api/v1/my-transactions/{$own}")->assertOk()->json('documents'))->pluck('document_kind');

        $this->assertTrue($kinds->contains('valid_id'));
        $this->assertFalse($kinds->contains('sale_document'), "SH-10: another sale's CI handover paper stays private");
        $this->assertFalse($kinds->contains('expense_proof'));
        // The other buyer's request is never readable at all, whatever it holds.
        $this->act($buyer)->getJson("/api/v1/my-transactions/{$foreign}")->assertNotFound();
    }

    #[Test]
    public function the_kinds_a_customer_may_receive_are_the_customer_facing_ones(): void
    {
        // The allow-list is the server's contract: expense_proof and inspection_photo are not on it, ever.
        $kinds = \App\Models\TransactionDocument::CUSTOMER_KINDS;
        $this->assertNotContains('expense_proof', $kinds);
        $this->assertNotContains('inspection_photo', $kinds);
        foreach (['valid_id', 'proof_of_billing', 'sell_photo', 'issue_photo', 'payment_receipt', 'sale_document', 'sale_certificate', 'deed_of_sale', 'official_receipt', 'certificate_of_registration', 'orcr'] as $kind) {
            $this->assertContains($kind, $kinds);
        }
    }
}
