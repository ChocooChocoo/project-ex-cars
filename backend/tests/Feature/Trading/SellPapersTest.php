<?php

namespace Tests\Feature\Trading;

use App\Services\Trading\SellFlow;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Trading\Concerns\TradingFixtures;
use Tests\TestCase;

/**
 * Plan Phase 4 (SN-13, SN-11, SN-14): a sell offer declares the OR, the CR and the deed of sale instead of
 * photographing them, the ceiling gate needs only the two verified IDs, and a rejected ID can be replaced by a
 * seller as well as by a buyer — but no submitted document can be deleted.
 */
class SellPapersTest extends TestCase
{
    use RefreshDatabase, TradingFixtures;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
    }

    /** The upload grants and stored files a sell offer sends: its photos and the four ID images. */
    private function preparedUploads($customer, int $photos = 1, int $issuePhotos = 0): array
    {
        $files = array_fill(0, $photos, ['kind' => 'sell_photo', 'key' => 'photo_paths[]']);
        foreach ([1, 2] as $n) {
            foreach (['front', 'back'] as $side) {
                $files[] = ['kind' => 'valid_id', 'key' => "id_{$side}_path_{$n}"];
            }
        }
        $files = array_merge($files, array_fill(0, $issuePhotos, ['kind' => 'issue_photo', 'key' => 'issue_photo_paths[]']));
        $prepared = $this->act($customer)->postJson('/api/v1/trading/sell/prepare-uploads', [
            'files' => array_map(fn ($f) => ['kind' => $f['kind'], 'type' => 'image/jpeg', 'size' => 1000], $files),
        ])->assertOk()->json();
        $form = [];
        foreach ($files as $i => $file) {
            $grant = $prepared['uploads'][$i];
            $this->post('/api/v1/trading/uploads', ['path' => $grant['path'], 'token' => $grant['token'], 'file' => UploadedFile::fake()->image('a.jpg')])->assertOk();
            if (str_ends_with($file['key'], '[]')) {
                $form[substr($file['key'], 0, -2)][] = $grant['path'];
            } else {
                $form[$file['key']] = $grant['path'];
            }
        }

        return [$prepared['transactionId'], $form];
    }

    private function offerForm(string $transactionId, array $uploads): array
    {
        return ['make' => 'Honda', 'model' => 'City', 'year' => 2019, 'mileage' => 40000, 'condition' => 'Good',
            'offered_amount' => 400000, 'has_known_issues' => 'no', 'meetup_method' => 'gce_visit', 'owner_number' => '1',
            'transaction_id' => $transactionId, 'id_type_1' => 'passport', 'id_type_2' => 'umid',
            'papers_checklist' => ['official_receipt' => 'has', 'certificate_of_registration' => 'expired', 'deed_of_sale' => 'does_not_have'],
            'signed_id_copies' => 'yes',
        ] + $uploads;
    }

    #[Test]
    public function a_full_offer_submits_after_all_its_uploads_in_the_same_minute(): void
    {
        $this->freezeTime();
        [$transactionId, $uploads] = $this->preparedUploads($this->customer(), photos: 6, issuePhotos: 6);
        $form = $this->offerForm($transactionId, $uploads);
        $form['has_known_issues'] = 'yes';
        $form['declared_issues'] = 'Minor dent on rear bumper.';

        $this->postJson('/api/v1/trading/sell', $form)->assertCreated()->assertJsonPath('id', $transactionId)
            ->assertHeader('X-RateLimit-Remaining', '9');
        $this->assertSame(16, DB::table('transaction_documents')->where('transaction_id', $transactionId)->count());
    }

    #[Test]
    public function a_new_offer_is_submitted_with_the_checklist_and_no_paper_files(): void
    {
        $seller = $this->customer();
        [$transactionId, $uploads] = $this->preparedUploads($seller);

        $id = $this->again()->postJson('/api/v1/trading/sell', $this->offerForm($transactionId, $uploads))->assertCreated()->json('id');

        // The answers are stored on sell_details, keyed by document kind.
        $checklist = json_decode(DB::table('sell_details')->where('transaction_id', $id)->value('papers_checklist'), true);
        $this->assertEquals(['official_receipt' => 'has', 'certificate_of_registration' => 'expired', 'deed_of_sale' => 'does_not_have', 'signed_id_copies' => true], $checklist);
        // Only the photos and the four ID images are files; the papers live on the checklist.
        $kinds = DB::table('transaction_documents')->where('transaction_id', $id)->pluck('document_kind')->unique()->sort()->values()->all();
        $this->assertSame(['sell_photo', 'valid_id'], $kinds);
        $this->assertSame(4, DB::table('transaction_documents')->where('transaction_id', $id)->where('document_kind', 'valid_id')->count());
    }

    #[Test]
    public function the_api_refuses_a_missing_or_invalid_checklist_answer(): void
    {
        $seller = $this->customer();
        [$transactionId, $uploads] = $this->preparedUploads($seller);
        $form = $this->offerForm($transactionId, $uploads);

        foreach ([
            'no checklist at all' => [],
            'an unknown answer' => ['official_receipt' => 'maybe', 'certificate_of_registration' => 'has', 'deed_of_sale' => 'has'],
            'one paper left unanswered' => ['official_receipt' => 'has', 'certificate_of_registration' => 'has'],
        ] as $case => $answers) {
            $body = $form;
            if ($answers === []) {
                unset($body['papers_checklist']);
            } else {
                $body['papers_checklist'] = $answers;
            }
            $this->again()->postJson('/api/v1/trading/sell', $body)->assertStatus(422);
            $this->assertSame(0, DB::table('transactions')->where('id', $transactionId)->count(), "refused: {$case}");
        }
        // Notes line 116: the signed ID copies tick is required.
        $body = $form;
        unset($body['signed_id_copies']);
        $this->again()->postJson('/api/v1/trading/sell', $body)->assertStatus(422)->assertJson(['message' => 'Confirm that you will bring the signed copies of your valid IDs.']);
        // Notes line 115: an expired deed of sale is accepted.
        $form['papers_checklist']['deed_of_sale'] = 'expired';
        $this->again()->postJson('/api/v1/trading/sell', $form)->assertCreated();
    }

    #[Test]
    public function no_new_offer_upload_kind_for_the_papers_is_granted(): void
    {
        $seller = $this->customer();

        // SN-13: the browser cannot ask for an OR/CR/Deed grant any more; only the photos and the IDs are uploadable.
        $this->act($seller)->postJson('/api/v1/trading/sell/prepare-uploads', [
            'files' => [
                ['kind' => 'sell_photo', 'type' => 'image/jpeg', 'size' => 1000],
                ['kind' => 'deed_of_sale', 'type' => 'image/jpeg', 'size' => 1000],
            ],
        ])->assertStatus(422);
        // The four ID images without a photo is the old papers-only offer, refused with the photo rule.
        $this->again()->postJson('/api/v1/trading/sell/prepare-uploads', [
            'files' => [['kind' => 'valid_id', 'type' => 'image/jpeg', 'size' => 1000]],
        ])->assertStatus(422)->assertJson(['message' => 'At least one vehicle photo is required.']);
    }

    #[Test]
    public function a_rejected_id_can_be_replaced_by_a_seller(): void
    {
        $seller = $this->customer();
        [$transactionId, $uploads] = $this->preparedUploads($seller);
        $id = $this->again()->postJson('/api/v1/trading/sell', $this->offerForm($transactionId, $uploads))->assertCreated()->json('id');
        // The Marketing Specialist asked for a new front of ID #1.
        DB::table('transaction_documents')->where('transaction_id', $id)
            ->where('document_kind', 'valid_id')->where('id_type', 'passport')->where('id_side', 'front')
            ->update(['verification_state' => 'rejected', 'rejection_reason' => 'Blurred photo']);

        $path = "{$id}/valid_id-".Str::random(8).'.jpg';
        $this->again()->post('/api/v1/trading/uploads', ['path' => $path, 'file' => UploadedFile::fake()->image('id.jpg')])->assertOk();
        $this->again()->postJson('/api/v1/trading/purchase-documents', [
            'transaction_id' => $id, 'document_kind' => 'valid_id', 'id_type' => 'passport', 'id_side' => 'front', 'storage_path' => $path,
        ])->assertOk();

        $replacement = DB::table('transaction_documents')->where('transaction_id', $id)->where('storage_path', $path)->first();
        $this->assertSame('pending', $replacement->verification_state);
        $this->assertSame(['valid_id', 'passport', 'front'], [$replacement->document_kind, $replacement->id_type, $replacement->id_side]);
        // The rejected row is kept for the record; the replacement is what the Marketing Specialist verifies now.
        $this->assertSame(2, DB::table('transaction_documents')->where('transaction_id', $id)->where('document_kind', 'valid_id')
            ->where('id_type', 'passport')->where('id_side', 'front')->count());
    }

    #[Test]
    public function a_seller_cannot_add_an_id_that_was_not_rejected(): void
    {
        $seller = $this->customer();
        [$transactionId, $uploads] = $this->preparedUploads($seller);
        $id = $this->again()->postJson('/api/v1/trading/sell', $this->offerForm($transactionId, $uploads))->assertCreated()->json('id');

        $path = "{$id}/valid_id-".Str::random(8).'.jpg';
        $this->again()->post('/api/v1/trading/uploads', ['path' => $path, 'file' => UploadedFile::fake()->image('id.jpg')])->assertOk();
        $this->again()->postJson('/api/v1/trading/purchase-documents', [
            'transaction_id' => $id, 'document_kind' => 'valid_id', 'id_type' => 'passport', 'id_side' => 'front', 'storage_path' => $path,
        ])->assertStatus(422);
    }

    #[Test]
    public function a_submitted_document_can_no_longer_be_deleted(): void
    {
        $buyer = $this->customer();
        $id = $this->buyRequest($buyer, $this->vehicle());
        $this->buyerDocuments($id, $buyer->id);
        $documentId = DB::table('transaction_documents')->where('transaction_id', $id)->value('id');

        // SN-14: the route is gone, so even the owner cannot remove a submitted document.
        $this->act($buyer)->deleteJson("/api/v1/trading/purchase-documents/{$documentId}")->assertNotFound();
        $this->assertNotNull(DB::table('transaction_documents')->where('id', $documentId)->value('id'));
    }

    #[Test]
    public function a_sell_offer_with_only_verified_ids_passes_the_ceiling_gate(): void
    {
        // SN-11: the OR/CR/Deed are inspected on site, so verified IDs open the gate on their own.
        $seller = $this->customer();
        [$transactionId, $uploads] = $this->preparedUploads($seller);
        $id = $this->again()->postJson('/api/v1/trading/sell', $this->offerForm($transactionId, $uploads))->assertCreated()->json('id');
        $this->assertSame(0, DB::table('transaction_documents')->where('transaction_id', $id)->whereIn('document_kind', ['official_receipt', 'certificate_of_registration', 'deed_of_sale', 'orcr'])->count());

        DB::table('transaction_documents')->where('transaction_id', $id)->where('document_kind', 'valid_id')->update(['verification_state' => 'verified']);
        $this->assertTrue(SellFlow::papersVerified(DB::table('transaction_documents')->where('transaction_id', $id)->get(['document_kind', 'verification_state', 'id_type', 'id_side'])));

        $this->act($this->account('marketing_specialist'))->postJson('/api/v1/staff/trading/sell/propose-purchase-ceiling', [
            'transaction_id' => $id, 'amount' => 380000,
        ])->assertOk();
        $this->assertSame('under_review', DB::table('transactions')->where('id', $id)->value('current_state'));
    }

    #[Test]
    public function an_older_offer_with_uploaded_papers_still_reads_its_documents(): void
    {
        // No data migration: a sell offer sent before SN-13 keeps its stored OR/CR/Deed and shows them.
        $seller = $this->customer();
        $id = (string) Str::uuid();
        DB::table('transactions')->insert(['id' => $id, 'customer_id' => $seller->id, 'created_by' => $seller->id, 'transaction_kind' => 'sell',
            'vehicle_id' => $this->vehicle(), 'current_state' => 'pending', 'opened_at' => now(), 'created_at' => now(), 'updated_at' => now()]);
        DB::table('sell_details')->insert(['id' => (string) Str::uuid(), 'transaction_id' => $id, 'offered_amount' => 500000, 'created_at' => now(), 'updated_at' => now()]);
        foreach (['orcr', 'deed_of_sale'] as $kind) {
            DB::table('transaction_documents')->insert(['id' => (string) Str::uuid(), 'transaction_id' => $id, 'document_kind' => $kind,
                'storage_path' => "{$id}/{$kind}.jpg", 'uploader_id' => $seller->id, 'verification_state' => 'verified', 'upload_date' => now()]);
        }

        $kinds = collect($this->act($seller)->getJson("/api/v1/my-transactions/{$id}")->assertOk()->json('documents'))->pluck('document_kind');
        $this->assertTrue($kinds->contains('orcr'));
        $this->assertTrue($kinds->contains('deed_of_sale'));
        // papers_checklist is null for that row, and nothing renders as a broken checklist.
        $this->assertNull(DB::table('sell_details')->where('transaction_id', $id)->value('papers_checklist'));
    }
}
