<?php

namespace App\Http\Controllers\Trading;

use App\Http\Controllers\Controller;
use App\Services\FileService;
use App\Services\Trading\BuyRules;
use App\Services\Trading\Trading;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Vehicle papers custody and the sale contract (was src/app/(staff)/transactions/handover-actions.ts). The
 * Confidential Informant keeps a car's papers; the contract lives on the same sale_handovers row.
 */
class HandoverController extends Controller
{
    private const NOT_FOUND = 'Approved purchase request not found.';

    private const CI_ONLY = 'Only the Confidential Informant handles the vehicle papers.';

    private const PAPERS_LABELS = ['requested' => 'Papers Requested', 'released_to_ci' => 'Papers Released to CI', 'handed_over' => 'Released', 'received' => 'Papers Received', 'returned' => 'On Hold'];

    private const FIELD_DOCUMENT_KINDS = ['orcr', 'official_receipt', 'certificate_of_registration', 'deed_of_sale', 'sale_document', 'other'];

    private function role(Request $request): string
    {
        return (string) $request->user()->role()?->value;
    }

    /** loadSale: an approved buy, its handover row locked. Outside a run() step it is read without locks. */
    private function sale(mixed $id): object
    {
        abort_unless(is_string($id) && Str::isUuid($id), 404, self::NOT_FOUND);
        $tx = Trading::lockTx($id);
        abort_if(! $tx || $tx->transaction_kind !== 'buy' || $tx->current_state !== 'approved', 404, self::NOT_FOUND);
        $details = DB::table('purchase_details')->where('transaction_id', $id)->first();
        $handover = DB::table('sale_handovers')->where('transaction_id', $id)->lockForUpdate()->first();
        $payments = DB::table('payment_records')->where('transaction_id', $id)->get(['payment_kind', 'amount', 'verified_by', 'rejected_at']);

        return (object) [
            'id' => $id, 'customerId' => $tx->customer_id, 'state' => $tx->current_state, 'details' => $details,
            'field' => BuyRules::isFieldArrangement($details),
            'paymentChecked' => $payments->contains(fn ($p) => $p->verified_by),
            'paidInFull' => BuyRules::verifiedTowardPrice($payments) >= (float) ($details?->final_price ?? 0),
            'papers' => $handover?->papers_status, 'handover' => $handover ?? (object) [],
        ];
    }

    /** setHandover: upsert the row and add a history line. */
    private function setHandover(object $sale, string $actorId, array $patch, string $reason): void
    {
        DB::table('sale_handovers')->updateOrInsert(['transaction_id' => $sale->id], $patch);
        Trading::history($sale->id, $sale->state, $sale->state, $actorId, $reason);
    }

    private function setPapers(object $sale, string $actorId, string $status, ?string $ciId = null): void
    {
        $this->setHandover($sale, $actorId, ['papers_status' => $status, 'papers_updated_at' => now()] + ($ciId ? ['papers_ci_id' => $ciId] : []), self::PAPERS_LABELS[$status]);
        if ($status === 'handed_over') {
            Trading::setPapersCustody($sale->id, 'released');
        }
    }

    /** The field case of a meet-up or delivery: [informant, mechanic]. */
    private function fieldTeam(object $sale): array
    {
        abort_unless($sale->field, 422, 'This request has no meet-up or delivery.');
        $case = DB::table('field_cases')->where('transaction_id', $sale->id)->whereIn('case_kind', ['delivery', 'buyer_meetup'])
            ->where('state', '!=', 'cancelled')->orderByDesc('created_at')->first(['assigned_confidential_informant', 'mechanic_id']);
        abort_unless($case, 422, 'The Sales Manager must assign the field case first.');

        return [$case->assigned_confidential_informant, $case->mechanic_id];
    }

    private function assertAssignedInformant(object $sale, string $userId): void
    {
        abort_unless($this->fieldTeam($sale)[0] === $userId, 403, 'Only the Confidential Informant assigned to this field case can do this.');
    }

    /** The assigned CI or, at a Meet Halfway only, the Mechanic. */
    private function assignedMember(object $sale, string $userId, string $role): string
    {
        [$informant, $mechanic] = $this->fieldTeam($sale);
        if ($role === 'confidential_informant' && $informant === $userId) {
            return 'informant';
        }
        if ($role === 'mechanic' && $mechanic === $userId && $sale->details?->arrangement_kind === 'meetup') {
            return 'mechanic';
        }
        abort(403, 'Only the team assigned to this field case can do this.');
    }

    private function step(Request $request, \Closure $work): JsonResponse
    {
        $actorId = $request->user()->id;
        $role = $this->role($request);
        Trading::run(fn () => $work($this->sale($request->input('transaction_id')), $actorId, $role));

        return response()->json(['success' => true]);
    }

    public function requestPapersRelease(Request $request): JsonResponse
    {
        abort_unless(in_array($this->role($request), ['sales_manager', 'ceo'], true), 403, 'Only the Sales Manager requests the papers.');

        return $this->step($request, function (object $sale, string $actorId) {
            abort_if($sale->field, 422, 'For a meet-up or a delivery, the Confidential Informant releases the papers on the field case.');
            // BC-4: only the sale that has an upfront payment to verify waits for the Head Accountant. A full payment
            // at a GCE visit is settled at the office, so its papers may be requested right after the approval.
            abort_if(BuyRules::needsPaymentCheckBeforePapers($sale->details) && ! $sale->paymentChecked, 422,
                'The Head Accountant must check the payment before the papers are requested.');
            abort_if($sale->papers && $sale->papers !== 'returned', 409, 'The papers were already requested.');
            $this->setPapers($sale, $actorId, 'requested');
            Trading::notify(['role' => 'confidential_informant'], 'papers_release_requested', 'Vehicle papers requested',
                "The Sales Manager asks for a sold car's papers. Approve and hand them over from Vehicle Papers.", $sale->id);
        });
    }

    public function approvePapersRelease(Request $request): JsonResponse
    {
        abort_unless($this->role($request) === 'confidential_informant', 403, self::CI_ONLY);

        return $this->step($request, function (object $sale, string $actorId) {
            abort_if($sale->papers !== 'requested', 409, 'No papers release is waiting.');
            $this->setPapers($sale, $actorId, 'handed_over', $actorId);
            Trading::notify(['role' => 'sales_manager'], 'papers_handed_over', 'Vehicle papers handed over',
                'The Confidential Informant approved the release. Record the papers as received, then mark the car sold.', $sale->id);
        });
    }

    public function receivePapers(Request $request): JsonResponse
    {
        abort_unless(in_array($this->role($request), ['sales_manager', 'ceo'], true), 403, 'Only the Sales Manager receives the papers.');

        return $this->step($request, function (object $sale, string $actorId) {
            abort_if($sale->field, 404, self::NOT_FOUND);
            abort_if($sale->papers !== 'handed_over', 409, 'The Confidential Informant has not handed the papers over yet.');
            $this->setPapers($sale, $actorId, 'received');
        });
    }

    public function releasePapersToCi(Request $request): JsonResponse
    {
        abort_unless($this->role($request) === 'confidential_informant', 403, self::CI_ONLY);

        return $this->step($request, function (object $sale, string $actorId) {
            $this->assertAssignedInformant($sale, $actorId);
            abort_if($sale->papers && $sale->papers !== 'returned', 409, 'The papers are already released.');
            $this->setPapers($sale, $actorId, 'released_to_ci', $actorId);
        });
    }

    public function handPapersToBuyer(Request $request): JsonResponse
    {
        abort_unless($this->role($request) === 'confidential_informant', 403, self::CI_ONLY);

        return $this->step($request, function (object $sale, string $actorId) {
            $this->assertAssignedInformant($sale, $actorId);
            abort_if($sale->papers !== 'released_to_ci', 409, 'Record the papers as released first.');
            abort_if(($sale->handover->contract_state ?? null) !== 'signed', 422, 'The buyer must sign the contract before the papers are handed over.');
            abort_if(BuyRules::isDirectPayment($sale->details) && ! $sale->paidInFull, 422, "Wait for the Head Accountant to verify the buyer's full payment before handing over the papers.");
            $this->setPapers($sale, $actorId, 'handed_over', $actorId);
            Trading::notify(['role' => 'sales_manager'], 'papers_handed_over', 'Vehicle papers handed to the buyer', 'The Confidential Informant handed the papers to the buyer.', $sale->id);
        });
    }

    public function saveContract(Request $request): JsonResponse
    {
        abort_unless(in_array($this->role($request), ['sales_manager', 'ceo'], true), 403, 'Only the Sales Manager writes the contract.');

        return $this->step($request, function (object $sale, string $actorId) use ($request) {
            abort_unless(BuyRules::signsInApp($sale->details), 422, 'This contract is signed on paper on delivery.');
            abort_unless(in_array($sale->handover->contract_state ?? 'draft', ['draft', 'returned'], true), 409, 'The contract can no longer be changed.');
            $body = trim((string) $request->input('body'));
            abort_if($body === '', 422, 'Write the contract first.');
            $submit = $request->input('submit') === '1';
            $this->setHandover($sale, $actorId, [
                'contract_body' => $body, 'contract_state' => $submit ? 'pending_approval' : 'draft', 'contract_written_by' => $actorId, 'contract_returned_reason' => null,
            ], $submit ? 'Contract sent for approval' : 'Contract draft saved');
            if ($submit) {
                Trading::notify(['role' => 'head_accountant'], 'contract_pending_approval', 'Contract waiting for approval',
                    'The Sales Manager wrote a contract. Read it on the request, then approve it or return it.', $sale->id);
            }
        });
    }

    public function reviewContract(Request $request): JsonResponse
    {
        abort_unless($this->role($request) === 'head_accountant', 403, 'Only the Head Accountant reviews the contract.');

        return $this->step($request, function (object $sale, string $actorId) use ($request) {
            abort_if(($sale->handover->contract_state ?? null) !== 'pending_approval', 409, 'No contract is waiting for approval.');
            if ($request->input('decision') === 'approve') {
                $this->setHandover($sale, $actorId, ['contract_state' => 'approved', 'contract_approved_by' => $actorId], 'Contract approved');
                Trading::notify(['userId' => $sale->customerId], 'contract_approved', 'Your contract is ready to sign', 'Read the contract on your request and sign it.', $sale->id);

                return;
            }
            $reason = trim((string) $request->input('reason'));
            abort_if($reason === '', 422, 'Give the reason for returning the contract.');
            $this->setHandover($sale, $actorId, ['contract_state' => 'returned', 'contract_returned_reason' => $reason], "Contract returned for revision: {$reason}");
            Trading::notify(['role' => 'sales_manager'], 'contract_returned', 'Contract returned for revision', "The Head Accountant returned the contract. Reason: {$reason}", $sale->id);
        });
    }

    public function recordBuyerMet(Request $request): JsonResponse
    {
        return $this->step($request, function (object $sale, string $actorId, string $role) {
            $this->assignedMember($sale, $actorId, $role);
            $this->setHandover($sale, $actorId, ['buyer_met_at' => now()], 'Buyer Met');
        });
    }

    public function reportSigning(Request $request): JsonResponse
    {
        abort_unless($this->role($request) === 'confidential_informant', 403, 'Only the assigned Confidential Informant reports the signing.');

        return $this->step($request, function (object $sale, string $actorId) {
            $this->assertAssignedInformant($sale, $actorId);
            abort_unless($sale->handover->buyer_met_at ?? null, 422, 'Record Buyer Met first.');
            $signed = ($sale->handover->contract_state ?? null) === 'signed';
            $faceToFace = ($sale->handover->signing_method ?? null) === 'face_to_face' && ($sale->handover->contract_state ?? null) === 'approved';
            abort_if(BuyRules::signsInApp($sale->details) && ! $signed && ! $faceToFace, 422, 'The buyer has not signed the contract in the app yet.');
            $this->setHandover($sale, $actorId, ['signing_reported_at' => now()] + ($signed ? [] : ['contract_state' => 'signed', 'contract_signed_at' => now()]), 'Contract Signed (reported by CI)');
            foreach (['sales_manager', 'head_accountant'] as $role) {
                Trading::notify(['role' => $role], 'contract_signing_reported', 'Contract signed', 'The buyer has signed the contract.', $sale->id);
            }
        });
    }

    public function recordFaceToFaceSigning(Request $request): JsonResponse
    {
        abort_unless(in_array($this->role($request), ['sales_manager', 'ceo'], true), 403, 'Only the Sales Manager records the signing.');

        return $this->step($request, function (object $sale, string $actorId) {
            abort_if($sale->field, 422, 'In the field, the Confidential Informant reports the signing.');
            abort_if(($sale->handover->signing_method ?? null) !== 'face_to_face', 422, 'The buyer did not choose face-to-face.');
            abort_if(($sale->handover->contract_state ?? null) !== 'approved', 409, 'The contract is not approved yet.');
            $this->setHandover($sale, $actorId, ['contract_state' => 'signed', 'contract_signed_at' => now()], 'Contract signed face-to-face');
        });
    }

    public function recordContractCopy(Request $request): JsonResponse
    {
        return $this->step($request, function (object $sale, string $actorId, string $role) {
            $member = $this->assignedMember($sale, $actorId, $role);
            abort_if(($sale->handover->contract_state ?? null) !== 'signed', 422, 'The contract is not signed yet.');
            $column = $member === 'informant' ? 'ci_copy_at' : 'mechanic_copy_at';
            $holder = $member === 'informant' ? 'Confidential Informant' : 'Mechanic';
            $this->setHandover($sale, $actorId, [$column => now()], "Signed contract kept by the {$holder}");
            $missing = BuyRules::missingContractCopies($sale->details, (object) ([$column => now()] + (array) $sale->handover));
            if ($missing) {
                Trading::notify(['role' => 'sales_manager'], 'contract_copy_missing', 'Signed contract not fully kept',
                    "The {$holder} recorded a signed copy. Still missing: ".implode(' and ', $missing).'.', $sale->id);
            }
        });
    }

    /** uploadFieldDocument (T11): the assigned CI files a paper against the sale. */
    public function uploadFieldDocument(Request $request, FileService $files): JsonResponse
    {
        abort_unless($this->role($request) === 'confidential_informant', 403, self::CI_ONLY);
        $data = $request->validate(['document_kind' => ['required', 'in:'.implode(',', self::FIELD_DOCUMENT_KINDS)], 'note' => ['nullable', 'string', 'max:500']],
            ['document_kind.*' => 'Choose the kind of document.', 'note.max' => 'Keep the note under 500 characters.']);
        $file = $request->file('file');
        abort_if(! $file || $file->getSize() === 0, 422, 'Attach the document.');
        $mime = (new \finfo(FILEINFO_MIME_TYPE))->file($file->getRealPath());
        abort_unless(in_array($mime, ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'], true), 422, 'Documents must be a JPEG, PNG, WebP image or a PDF.');
        abort_if($file->getSize() > FileService::MAX_BYTES, 422, 'The document must be 2 MB or smaller.');
        $stored = null;
        try {
            Trading::run(function () use ($request, $files, $file, $data, &$stored) {
                $sale = $this->sale($request->input('transaction_id'));
                $actorId = $request->user()->id;
                $this->assertAssignedInformant($sale, $actorId);
                $stored = $files->store($file, 'transaction-documents', $sale->id);
                DB::table('transaction_documents')->insert([
                    'id' => (string) Str::uuid(), 'transaction_id' => $sale->id, 'document_kind' => $data['document_kind'], 'storage_path' => $stored['path'],
                    'uploader_id' => $actorId, 'verification_state' => 'pending', 'note' => trim((string) ($data['note'] ?? '')) ?: null, 'upload_date' => now(),
                ]);
                Trading::history($sale->id, $sale->state, $sale->state, $actorId, 'Document added by the Confidential Informant: '.self::documentLabel($data['document_kind']));
            });
        } catch (\Throwable $e) {
            $files->delete('transaction-documents', $stored['path'] ?? null);
            throw $e;
        }

        return response()->json(['success' => true]);
    }

    /** recordFieldSignatures (T11): buyer and CI sign the contract on the device. */
    public function recordFieldSignatures(Request $request, FileService $files): JsonResponse
    {
        abort_unless($this->role($request) === 'confidential_informant', 403, self::CI_ONLY);
        $buyer = $request->file('buyer_signature');
        $ci = $request->file('ci_signature');
        abort_if(! $buyer || ! $ci || $buyer->getSize() === 0 || $ci->getSize() === 0, 422, 'Draw both signatures.');
        foreach ([$buyer, $ci] as $f) {
            abort_if($f->getSize() > FileService::MAX_BYTES, 422, 'Each signature must be 2 MB or smaller.');
            abort_if((new \finfo(FILEINFO_MIME_TYPE))->file($f->getRealPath()) !== 'image/png', 422, 'The signatures must be PNG images.');
        }
        $uploaded = [];
        try {
            Trading::run(function () use ($request, $files, $buyer, $ci, &$uploaded) {
                $sale = $this->sale($request->input('transaction_id'));
                $actorId = $request->user()->id;
                $this->assertAssignedInformant($sale, $actorId);
                $stamp = now()->getTimestampMs();
                $buyerPath = "{$sale->id}/signature-buyer-{$stamp}.png";
                $ciPath = "{$sale->id}/signature-ci-{$stamp}.png";
                $uploaded[] = $files->storeAt($buyer, 'transaction-documents', $buyerPath)['path'];
                $uploaded[] = $files->storeAt($ci, 'transaction-documents', $ciPath)['path'];
                $this->setHandover($sale, $actorId, [
                    'signature_path' => $buyerPath, 'ci_signature_path' => $ciPath, 'contract_state' => 'signed', 'contract_signed_at' => now(), 'signing_method' => 'in_app',
                ], 'Contract signed in the field by the buyer and the Confidential Informant');
                Trading::notify(['role' => 'sales_manager'], 'contract_signed', 'Contract signed in the field',
                    'The buyer and the Confidential Informant signed the contract on the device.', $sale->id);
            });
        } catch (\Throwable $e) {
            foreach ($uploaded as $path) {
                $files->delete('transaction-documents', $path);
            }
            throw $e;
        }

        return response()->json(['success' => true]);
    }

    /**
     * BC-3: the Sales Manager signs a GCE-visit sale for GCE, before the buyer signs it in the app. The signature
     * is drawn on the Deed of Sale (and the Policy & Warranty on financing) above the Sales Manager's printed name.
     */
    public function recordSmSignature(Request $request, FileService $files): JsonResponse
    {
        abort_unless(in_array($this->role($request), ['sales_manager', 'ceo'], true), 403, 'Only the Sales Manager signs for GCE at a GCE visit.');
        $file = $request->file('signature');
        abort_if(! $file || $file->getSize() === 0, 422, 'Draw your signature.');
        abort_if($file->getSize() > FileService::MAX_BYTES, 422, 'The signature must be 2 MB or smaller.');
        abort_if((new \finfo(FILEINFO_MIME_TYPE))->file($file->getRealPath()) !== 'image/png', 422, 'The signature must be a PNG image.');
        $stored = null;
        try {
            Trading::run(function () use ($request, $files, $file, &$stored) {
                $sale = $this->sale($request->input('transaction_id'));
                $actorId = $request->user()->id;
                abort_unless(BuyRules::needsSmSignature($sale->details), 422, 'Only a GCE-visit sale is signed by the Sales Manager.');
                abort_if(($sale->handover->contract_state ?? null) === 'signed', 409, 'The buyer has already signed the contract.');
                abort_if(($sale->handover->sm_signature_path ?? null) !== null, 409, 'You have already signed this sale.');
                $path = "{$sale->id}/signature-sm-".now()->getTimestampMs().'.png';
                $stored = $files->storeAt($file, 'transaction-documents', $path)['path'];
                $this->setHandover($sale, $actorId, ['sm_signature_path' => $path, 'sm_signed_by' => $actorId, 'sm_signed_at' => now()],
                    'Signed for GCE by the Sales Manager');
            });
        } catch (\Throwable $e) {
            $files->delete('transaction-documents', $stored);
            throw $e;
        }

        return response()->json(['success' => true]);
    }

    public static function documentLabel(?string $kind): string
    {
        $label = str_replace('_', ' ', (string) ($kind ?? 'document'));

        return match ($label) {
            'valid id' => 'Valid ID', 'orcr' => 'ORCR', 'official receipt' => 'Official Receipt (OR)',
            'certificate of registration' => 'Certificate of Registration (CR)', default => ucfirst($label),
        };
    }
}
