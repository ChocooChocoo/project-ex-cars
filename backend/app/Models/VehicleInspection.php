<?php

namespace App\Models;

use App\Services\FileService;
use App\Support\ApiRow;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Generated from the final Supabase schema (table `vehicle_inspections`). Mass assignment stays closed until a phase adds $fillable for its actor.
class VehicleInspection extends Model
{
    use HasUuids;

    protected $table = 'vehicle_inspections';

    const UPDATED_AT = null;

    /** The two answers a seller meet-up inspection accepts (SH-7). */
    public const PART_STATUSES = ['good', 'for_repair'];

    protected function casts(): array
    {
        return [
            'condition_score' => 'integer',
            'inspection_date' => 'immutable_datetime',
        ];
    }

    public function mechanic(): BelongsTo
    {
        return $this->belongsTo(User::class, 'mechanic_id');
    }

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class, 'vehicle_id');
    }

    /** The active checklist, top to bottom, as the browser renders it. */
    public static function checklistNodes(): \Illuminate\Support\Collection
    {
        return InspectionChecklistNode::query()->where('active', true)
            ->orderBy('display_order')->get(['id', 'parent_id', 'level', 'name', 'display_order']);
    }

    /**
     * The leaf parts: a part, or a component/system with no children of its own. Only these are answered.
     *
     * @param  iterable<object>  $nodes
     * @return list<object>
     */
    public static function leafNodes(iterable $nodes): array
    {
        $rows = collect($nodes)->all();
        $parentIds = collect($rows)->pluck('parent_id')->filter()->unique()->all();

        return array_values(array_filter($rows, fn ($node) => ! in_array($node->id, $parentIds, true)));
    }

    /**
     * SH-7: the reported seller meet-up inspection of a field case as the field page, the Marketing Specialist
     * and (Phase 8) the Head Accountant read it: part, answer, repair cost, declared or hidden, photos.
     */
    public static function pack(?string $fieldCaseId, ?string $transactionId = null): ?array
    {
        if (! $fieldCaseId) {
            return null;
        }
        $inspection = self::query()->where('field_case_id', $fieldCaseId)->orderByDesc('inspection_date')->first();
        if (! $inspection) {
            return null;
        }
        $nodes = self::checklistNodes()->keyBy('id');
        $results = InspectionChecklistResult::query()->where('inspection_id', $inspection->id)->get();
        $files = app(FileService::class);
        $photos = $transactionId
            ? TransactionDocument::query()->where('transaction_id', $transactionId)->where('document_kind', 'inspection_photo')
                ->whereIn('note', $results->pluck('checklist_entry_id')->all())->orderBy('upload_date')->get(['id', 'note', 'storage_path'])
            : collect();
        $byNode = $photos->groupBy('note');

        $parts = [];
        $total = 0.0;
        foreach ($results as $result) {
            $node = $nodes[$result->checklist_entry_id] ?? null;
            $cost = $result->repair_cost === null ? null : (float) $result->repair_cost;
            if ($result->status === 'for_repair' && $cost !== null) {
                $total += $cost;
            }
            // SH-4: the report reuses the first inspection photo when the Mechanic attaches none of his own.
            $photos = $byNode->get($result->checklist_entry_id) ?? collect();
            $parts[] = [
                'result_id' => $result->id,
                'node_id' => $result->checklist_entry_id,
                'name' => $node?->name ?? 'Part',
                'level' => $node?->level,
                'parent_id' => $node?->parent_id,
                'status' => $result->status,
                'cost' => $cost,
                'notes' => $result->notes,
                'is_hidden_issue' => (bool) $result->is_hidden_issue,
                'photos' => $photos->map(fn ($photo) => [
                    'id' => $photo->id,
                    'url' => $files->signedUrl('transaction-documents', $photo->storage_path, 3600),
                ])->values()->all(),
                'photo_path' => $photos->first()?->storage_path,
            ];
        }

        return [
            'inspection_id' => $inspection->id,
            'inspected_at' => ApiRow::iso($inspection->inspection_date),
            'findings' => $inspection->findings,
            'parts' => $parts,
            'total' => $total,
        ];
    }
}
