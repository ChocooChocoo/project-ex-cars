<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Generated from the final Supabase schema (table `inspection_issue_reports`). Mass assignment stays closed until a phase adds $fillable for its actor.
class InspectionIssueReport extends Model
{
    use HasUuids;

    protected $table = 'inspection_issue_reports';

    const UPDATED_AT = null;

    protected function casts(): array
    {
        return [
            'repair_estimate' => 'decimal:2',
            'is_profitable' => 'boolean',
            'recalculated_price' => 'decimal:2',
            'new_ceiling' => 'decimal:2',
            'seller_response_at' => 'immutable_datetime',
        ];
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function fieldCase(): BelongsTo
    {
        return $this->belongsTo(FieldCase::class, 'field_case_id');
    }

    public function proposal(): BelongsTo
    {
        return $this->belongsTo(VehiclePriceProposal::class, 'proposal_id');
    }

    public function transaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class, 'transaction_id');
    }
}
