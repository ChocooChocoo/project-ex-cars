<?php

namespace App\Http\Controllers\Field;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Trading\CustomerTradingReadController;
use App\Http\Controllers\Trading\HandoverController;
use App\Models\FieldCase;
use App\Models\SaleHandover;
use App\Models\SellDetail;
use App\Models\Transaction;
use App\Models\TransactionDocument;
use App\Models\Vehicle;
use App\Models\VehicleInspection;
use App\Services\FileService;
use App\Services\Trading\Trading;
use App\Support\ApiRow;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;

/** Field pages (was (staff)/sell-submissions, field-cases and field-cases/[id] page loaders). */
class FieldReadController extends Controller
{
    private const OVERSEERS = ['acquisition' => ['ceo', 'marketing_specialist'], 'delivery' => ['ceo', 'sales_manager'], 'buyer_meetup' => ['ceo', 'sales_manager'], 'recovery' => ['ceo', 'head_accountant']];

    private const FIELD_TEAM = ['confidential_informant', 'mechanic', 'head_security'];

    private const REGISTRATION_KINDS = ['orcr', 'official_receipt', 'certificate_of_registration', 'deed_of_sale'];

    private static function iso(mixed $value): ?string
    {
        return $value ? CarbonImmutable::parse($value, 'UTC')->toJSON() : null;
    }

    /** GET /staff/sell-submissions: field roles see the car, photos and checklist of every sell offer (list_field_sell_submissions). */
    public function sellSubmissions(Request $request): JsonResponse
    {
        $rows = DB::table('transactions as t')->join('sell_details as s', 's.transaction_id', '=', 't.id')->leftJoin('vehicles as v', 'v.id', '=', 't.vehicle_id')
            ->where('t.transaction_kind', 'sell')->orderByDesc('t.opened_at')
            ->get(['t.id as transaction_id', 't.current_state', 't.opened_at', 'v.make as vehicle_make', 'v.model as vehicle_model', 'v.year as vehicle_year', 'v.stock_code as vehicle_stock_code', 's.condition_items']);
        $photos = TransactionDocument::query()->whereIn('transaction_id', $rows->pluck('transaction_id'))->where('document_kind', 'sell_photo')->orderBy('upload_date')
            ->get(['id', 'transaction_id', 'document_kind', 'storage_path']);
        $ids = $rows->flatMap(fn ($r) => json_decode((string) $r->condition_items, true) ?: [])->filter(fn ($v) => is_string($v) && Str::isUuid($v))->unique()->values();

        return response()->json([
            'role' => $request->user()->role()?->value,
            'submissions' => $rows->map(fn ($r) => [
                'transaction_id' => $r->transaction_id, 'current_state' => $r->current_state, 'opened_at' => self::iso($r->opened_at),
                'vehicle_make' => $r->vehicle_make, 'vehicle_model' => $r->vehicle_model, 'vehicle_year' => $r->vehicle_year === null ? null : (int) $r->vehicle_year,
                'vehicle_stock_code' => $r->vehicle_stock_code, 'condition_items' => json_decode((string) $r->condition_items, true) ?? [],
            ])->values(),
            'photos' => CustomerTradingReadController::signedDocuments($photos),
            'nodeNames' => $ids->isEmpty() ? (object) [] : DB::table('inspection_checklist_nodes')->whereIn('id', $ids)->pluck('name', 'id'),
        ]);
    }

    /** GET /staff/field-cases: the cases the caller may read (FieldCasePolicy), the worker directory and the pickers. */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $cases = FieldCase::query()->orderByDesc('created_at')->get()->filter(fn ($c) => Gate::forUser($user)->allows('view', $c))->values();
        $transactions = Transaction::query()->orderByDesc('opened_at')->limit(100)->get()->filter(fn ($t) => Gate::forUser($user)->allows('view', $t))->values();
        $vehicles = Vehicle::query()->orderByDesc('created_at')->limit(100)->get(['id', 'make', 'model', 'year', 'stock_code']);
        $txVehicles = Vehicle::query()->whereIn('id', $transactions->pluck('vehicle_id')->filter())->get(['id', 'make', 'model', 'year', 'stock_code'])->keyBy('id');
        $names = DB::table('profiles')->whereIn('id', $transactions->pluck('customer_id'))->pluck('full_name', 'id');

        return response()->json([
            'role' => $user->role()?->value,
            'currentUserId' => $user->id,
            'cases' => ApiRow::list($cases),
            'workers' => Trading::fieldWorkers()->map(fn ($w) => (array) $w)->values(),
            'transactions' => $transactions->map(fn ($t) => ApiRow::of($t, ['id', 'transaction_kind', 'current_state'])
                + ['profiles' => ['full_name' => $names[$t->customer_id] ?? null], 'vehicles' => ApiRow::of($txVehicles[$t->vehicle_id] ?? null)])->values(),
            'vehicles' => ApiRow::list($vehicles),
        ]);
    }

    /** previous-owner-documents.ts + loadPapers: rows for the field team's papers card. */
    private static function papers(string $transactionId, ?string $vehicleId): array
    {
        $rows = function (iterable $docs, string $source) {
            return collect(CustomerTradingReadController::signedDocuments($docs))->map(fn ($d) => [
                'id' => $d['id'], 'document_kind' => (string) ($d['document_kind'] ?? ''), 'source' => $source, 'label' => HandoverController::documentLabel($d['document_kind'] ?? null),
                'uploaded_at' => $d['upload_date'] ?? null, 'signed_url' => $d['signed_url'], 'is_image' => $d['is_image'], 'note' => $d['note'] ?? null,
            ])->all();
        };
        $columns = ['id', 'transaction_id', 'document_kind', 'storage_path', 'upload_date', 'note'];
        $previous = collect();
        if ($vehicleId) {
            $sellId = DB::table('transactions')->where('vehicle_id', $vehicleId)->where('transaction_kind', 'sell')->orderBy('opened_at')->value('id');
            if ($sellId) {
                $previous = TransactionDocument::query()->where('transaction_id', $sellId)->whereIn('document_kind', self::REGISTRATION_KINDS)->orderBy('upload_date')->get($columns);
            }
        }
        $own = TransactionDocument::query()->where('transaction_id', $transactionId)->orderBy('upload_date')->get($columns);
        $ci = $own->filter(fn ($d) => str_contains((string) $d->storage_path, '/ci-doc-'));
        $gce = $own->reject(fn ($d) => str_contains((string) $d->storage_path, '/ci-doc-'))->filter(fn ($d) => in_array($d->document_kind, self::REGISTRATION_KINDS, true));

        return [...$rows($previous, 'previous_owner'), ...$rows($gce, 'gce'), ...$rows($ci, 'ci')];
    }

    /** loadFieldMoney: the CI's budget and expenses with signed receipt links. */
    private static function money(string $caseId): array
    {
        $budget = DB::table('disbursement_requests')->where('field_case_id', $caseId)->orderByDesc('created_at')
            ->first(['id', 'status', 'amount_cents', 'purpose', 'rejection_reason', 'returned_cents', 'returned_at', 'return_confirmed_at']);
        $expenses = DB::table('field_case_expenses')->where('field_case_id', $caseId)->orderBy('submitted_at')
            ->get(['id', 'amount', 'description', 'submitted_by', 'submitted_at', 'reimbursed_at', 'proof_document_id']);
        $paths = DB::table('transaction_documents')->whereIn('id', $expenses->pluck('proof_document_id')->filter())->whereNotNull('storage_path')->pluck('storage_path', 'id');
        $files = app(FileService::class);

        return [
            'budget' => $budget ? ['id' => $budget->id, 'status' => $budget->status, 'amount_cents' => (int) $budget->amount_cents,
                'purpose' => $budget->purpose, 'rejection_reason' => $budget->rejection_reason,
                'returned_cents' => $budget->returned_cents === null ? null : (int) $budget->returned_cents,
                'returned_at' => self::iso($budget->returned_at), 'return_confirmed_at' => self::iso($budget->return_confirmed_at)] : null,
            'expenses' => self::expenseRows($expenses)->map(fn ($e) => $e + ['proof_url' => $e['proof_document_id'] && isset($paths[$e['proof_document_id']])
                ? $files->signedUrl('transaction-documents', $paths[$e['proof_document_id']], 3600) : null])->values()->all(),
        ];
    }

    private static function expenseRows(iterable $expenses): \Illuminate\Support\Collection
    {
        return collect($expenses)->map(fn ($e) => array_merge((array) $e, [
            'amount' => (float) $e->amount, 'submitted_at' => self::iso($e->submitted_at), 'reimbursed_at' => self::iso($e->reimbursed_at),
        ]));
    }

    private static function transactionPack(string $id, array $vehicleColumns, ?array $purchaseColumns = null, bool $sell = false): ?array
    {
        $tx = Transaction::query()->find($id);
        if (! $tx) {
            return null;
        }
        $profile = DB::table('profiles')->where('id', $tx->customer_id)->first(['full_name', 'phone']);
        $vehicle = $tx->vehicle_id ? Vehicle::query()->find($tx->vehicle_id) : null;
        $row = ApiRow::of($tx, ['id', 'current_state']) + ['profiles' => $profile ? (array) $profile : null, 'vehicles' => ApiRow::of($vehicle, $vehicleColumns)];
        if ($purchaseColumns) {
            $row['purchase_details'] = ApiRow::of(\App\Models\PurchaseDetail::query()->where('transaction_id', $id)->first(), $purchaseColumns);
        }
        if ($sell) {
            $row['sell_details'] = ApiRow::of(SellDetail::query()->where('transaction_id', $id)->first());
        }

        return $row;
    }

    /** GET /staff/field-cases/{id}: the case pack for its overseers and its assigned team. */
    public function show(Request $request, string $id): JsonResponse
    {
        abort_unless(Str::isUuid($id), 404);
        $user = $request->user();
        $role = (string) $user->role()?->value;
        $case = FieldCase::query()->where('id', $id)->whereIn('case_kind', ['acquisition', 'delivery', 'buyer_meetup', 'recovery'])->first();
        abort_unless($case?->transaction_id, 404, 'Resource not found.');
        $assigned = in_array($user->id, [$case->assigned_confidential_informant, $case->mechanic_id, $case->head_security_id], true);
        $overseer = in_array($role, self::OVERSEERS[$case->case_kind] ?? [], true);
        $ciViewer = $role === 'confidential_informant' && in_array($case->case_kind, ['delivery', 'buyer_meetup'], true);
        abort_unless($overseer || $ciViewer || ($assigned && in_array($role, self::FIELD_TEAM, true)), 403, 'You do not have permission for this action.');
        $base = ['kind' => $case->case_kind, 'role' => $role, 'userId' => $user->id, 'assigned' => $assigned, 'fieldCase' => ApiRow::of($case)];

        if ($case->case_kind === 'recovery') {
            $transaction = self::transactionPack($case->transaction_id, ['make', 'model', 'year']);
            abort_unless($transaction, 404);
            $files = app(FileService::class);
            $evidence = DB::table('transaction_documents')->where('transaction_id', $case->transaction_id)->where('document_kind', 'inspection_photo')->get(['id', 'storage_path'])
                ->filter(fn ($p) => str_contains((string) $p->storage_path, '/tow-'))
                ->map(fn ($p) => ['id' => $p->id, 'url' => $files->signedUrl('transaction-documents', $p->storage_path, 900) ?? ''])->values();

            return response()->json($base + [
                'transaction' => ['id' => $transaction['id'], 'profiles' => $transaction['profiles'], 'vehicles' => $transaction['vehicles']],
                'mechanics' => Trading::fieldWorkers()->where('role', 'mechanic')->map(fn ($w) => (array) $w)->values(),
                'evidence' => $evidence,
            ]);
        }

        if ($case->case_kind !== 'acquisition') {
            // BH-8: a buyer meet-up shows where to go, so its pin and address travel with the case pack.
            $purchaseColumns = $case->case_kind === 'delivery'
                ? ['final_price', 'delivery_fee', 'downpayment_amount', 'payment_method', 'arrangement_kind']
                : ['payment_method', 'arrangement_kind', 'meetup_lat', 'meetup_lng', 'meetup_address'];
            $transaction = self::transactionPack($case->transaction_id, ['id', 'make', 'model', 'year', 'stock_code'], $purchaseColumns);
            abort_unless($transaction, 404);

            return response()->json($base + [
                'transaction' => $transaction,
                'handover' => ApiRow::of(SaleHandover::query()->find($case->transaction_id)),
                'papers' => self::papers($case->transaction_id, $transaction['vehicles']['id'] ?? null),
                'money' => self::money($case->id),
            ]);
        }

        $transaction = self::transactionPack($case->transaction_id, ['make', 'model', 'year', 'stock_code', 'mileage'], null, true);
        abort_unless($transaction, 404);
        $documents = TransactionDocument::query()->where('transaction_id', $case->transaction_id)
            ->whereIn('document_kind', ['sell_photo', 'valid_id', 'orcr', 'official_receipt', 'certificate_of_registration', 'deed_of_sale', 'inspection_photo', 'expense_proof'])
            ->get(['id', 'document_kind', 'id_type', 'verification_state', 'storage_path']);
        $expenses = DB::table('field_case_expenses')->where('field_case_id', $id)->orderBy('submitted_at')->get(['id', 'amount', 'description', 'submitted_by', 'submitted_at', 'reimbursed_at']);
        $fund = DB::table('disbursement_requests')->where('purchase_transaction_id', $case->transaction_id)->where('status', '!=', 'rejected')->orderByDesc('created_at')
            ->first(['id', 'status', 'amount_cents', 'purpose', 'requested_by', 'rejection_reason', 'returned_cents', 'returned_at', 'return_confirmed_at']);

        return response()->json($base + [
            'transaction' => $transaction,
            'sellDetails' => $transaction['sell_details'],
            'documents' => CustomerTradingReadController::signedDocuments($documents),
            'expenses' => self::expenseRows($expenses)->values(),
            // SH-7: the checklist tree and the part-by-part result the Mechanic answers in the inspection card.
            'inspection' => VehicleInspection::pack($case->id, $case->transaction_id),
            'checklist' => ApiRow::list(VehicleInspection::checklistNodes()),
            'fund' => $fund ? array_merge((array) $fund, ['amount_cents' => (int) $fund->amount_cents, 'returned_cents' => $fund->returned_cents === null ? null : (int) $fund->returned_cents,
                'returned_at' => self::iso($fund->returned_at), 'return_confirmed_at' => self::iso($fund->return_confirmed_at)]) : null,
        ]);
    }
}
