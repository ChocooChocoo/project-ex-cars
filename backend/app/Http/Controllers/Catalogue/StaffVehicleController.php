<?php

namespace App\Http\Controllers\Catalogue;

use App\Http\Controllers\Controller;
use App\Models\DisbursementRequest;
use App\Models\ReconditioningFundReceipt;
use App\Models\ReconditioningFundRequest;
use App\Models\ReconditioningJob;
use App\Models\ReconditioningPart;
use App\Models\Transaction;
use App\Models\Vehicle;
use App\Models\VehicleMedia;
use App\Models\VehiclePriceProposal;
use App\Services\FileService;
use App\Support\ApiRow;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** Staff vehicle inventory reads and showroom media (route group: role = business staff). */
class StaffVehicleController extends Controller
{
    /** GET /staff/vehicles: (staff)/vehicles/page.tsx. */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $vehicles = Vehicle::query()->orderByDesc('created_at')->get();

        $proposals = collect();
        if ($user->hasRole('ceo', 'head_accountant')) {
            $proposals = VehiclePriceProposal::query()->with('vehicle:id,make,model,year')->where('decision', 'pending')
                ->orderByDesc('created_at')->get();
        }
        // T10: what GCE paid the seller, next to each proposed selling price.
        $acquisitions = $proposals->isEmpty() ? collect() : Transaction::query()
            ->join('sell_details', 'sell_details.transaction_id', '=', 'transactions.id')
            ->where('transactions.transaction_kind', 'sell')->where('transactions.current_state', 'completed')
            ->whereIn('transactions.vehicle_id', $proposals->pluck('vehicle_id')->unique())
            ->whereNotNull('sell_details.agreed_price')
            ->pluck('sell_details.agreed_price', 'transactions.vehicle_id');

        $reconditioning = [];
        if ($user->hasRole('marketing_specialist')) {
            foreach (ReconditioningJob::query()->orderByDesc('created_at')->get(['vehicle_id', 'state', 'papers_processed_at']) as $job) {
                $reconditioning[$job->vehicle_id] ??= ['state' => $job->state, 'papers_processed_at' => $job->papers_processed_at?->toJSON()];
            }
        }

        return response()->json([
            'vehicles' => ApiRow::list($vehicles),
            'proposals' => $proposals->map(fn ($p) => ApiRow::of($p) + [
                'vehicles' => ApiRow::of($p->vehicle, ['make', 'model', 'year']),
                'acquisition_price' => isset($acquisitions[$p->vehicle_id]) ? (float) $acquisitions[$p->vehicle_id] : null,
            ])->values(),
            'reconditioning_by_vehicle' => (object) $reconditioning,
            'default_markup_pct' => ShowroomController::globalMarkupPct(),
        ]);
    }

    /** GET /staff/vehicles/{id}: (staff)/vehicles/[id]/page.tsx. */
    public function show(Request $request, FileService $files, string $id): JsonResponse
    {
        $user = $request->user();
        $vehicle = Vehicle::query()->findOrFail($id);
        $media = VehicleMedia::query()->where('vehicle_id', $id)->orderBy('display_order')
            ->get(['id', 'media_kind', 'storage_path', 'display_order']);

        $proposal = $user->hasRole('ceo')
            ? VehiclePriceProposal::query()->where('vehicle_id', $id)->where('decision', 'pending')->orderByDesc('created_at')
                ->first(['id', 'proposed_amount', 'notes', 'created_at', 'proposal_kind'])
            : null;
        $revision = $user->hasRole('marketing_specialist') && in_array($vehicle->listing_state, ['draft', 'repairing'], true)
            ? VehiclePriceProposal::query()->where('vehicle_id', $id)->whereNotIn('proposal_kind', ['purchase_ceiling', 'revised_ceiling'])
                ->orderByDesc('created_at')->first(['decision', 'decision_notes', 'decision_date'])
            : null;

        return response()->json([
            'vehicle' => ApiRow::of($vehicle),
            'media' => ApiRow::list($media),
            'proposal' => ApiRow::of($proposal),
            'reconditioning' => $this->latestReconditioning($files, $id),
            'revision' => ApiRow::of($revision),
        ]);
    }

    /** §6 steps 27–38: latest reconditioning job with parts, fund requests, receipts; private photos get 1 h links. */
    private function latestReconditioning(FileService $files, string $vehicleId): ?array
    {
        $job = ReconditioningJob::query()->where('vehicle_id', $vehicleId)->orderByDesc('created_at')->first();
        if (! $job) {
            return null;
        }
        $row = ApiRow::of($job);
        $disbursement = $job->disbursement_id ? DisbursementRequest::query()->find($job->disbursement_id) : null;
        $row['disbursement_requests'] = ApiRow::of($disbursement, ['status', 'amount_cents']);
        $row['reconditioning_parts'] = ReconditioningPart::query()->where('job_id', $job->id)->orderBy('created_at')->get()
            ->map(fn ($part) => ApiRow::of($part) + ['photo_url' => $files->signedUrl('reconditioning-receipts', $part->photo_path)])->values();
        $row['reconditioning_fund_requests'] = ReconditioningFundRequest::query()->where('job_id', $job->id)->orderBy('created_at')->get()
            ->map(function ($request) use ($files) {
                $receipts = ReconditioningFundReceipt::query()->where('fund_request_id', $request->id)->orderBy('created_at')->get();
                $disbursement = $request->disbursement_id ? DisbursementRequest::query()->find($request->disbursement_id) : null;

                return ApiRow::of($request) + [
                    'reconditioning_fund_receipts' => $receipts->map(fn ($r) => ApiRow::of($r) + [
                        'signed_url' => $files->signedUrl('reconditioning-receipts', $r->storage_path),
                    ])->values(),
                    'disbursement_requests' => ApiRow::of($disbursement, ['status']),
                ];
            })->values();

        return $row;
    }

    /** POST /staff/vehicles/{id}/media (multipart: media_kind, file). Marketing Specialist only. */
    public function storeMedia(Request $request, FileService $files, string $id): JsonResponse
    {
        Vehicle::query()->findOrFail($id);
        $data = $request->validate([
            'media_kind' => ['required', 'in:photo,360_view,interior'],
            'file' => ['required', 'file'],
        ], ['media_kind.*' => 'Invalid media kind', 'file.required' => 'Vehicle and file are required']);

        $stored = $files->store($request->file('file'), 'showroom-media', $id);
        try {
            $media = DB::transaction(function () use ($id, $data, $stored, $request) {
                $max = VehicleMedia::query()->where('vehicle_id', $id)->where('media_kind', $data['media_kind'])->lockForUpdate()->max('display_order');
                $media = (new VehicleMedia)->forceFill([
                    'vehicle_id' => $id, 'media_kind' => $data['media_kind'], 'storage_path' => $stored['path'],
                    'display_order' => ($max ?? -1) + 1, 'public_state' => true, 'uploaded_by' => $request->user()->id,
                ]);
                $media->save();

                return $media;
            });
        } catch (\Throwable $e) {
            $files->delete('showroom-media', $stored['path']);
            throw $e;
        }

        return response()->json(ApiRow::of($media->fresh()), 201);
    }

    /** DELETE /staff/vehicle-media/{id}. Marketing Specialist only. */
    public function destroyMedia(FileService $files, string $mediaId): JsonResponse
    {
        $media = VehicleMedia::query()->findOrFail($mediaId);
        $media->delete();
        $files->delete('showroom-media', $media->storage_path);

        return response()->json(['vehicle_id' => $media->vehicle_id]);
    }
}
