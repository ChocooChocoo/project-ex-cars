<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Generated from the final Supabase schema (table `inspection_checklist_results`). Mass assignment stays closed until a phase adds $fillable for its actor.
class InspectionChecklistResult extends Model
{
    use HasUuids;

    protected $table = 'inspection_checklist_results';

    public $timestamps = false;

    protected function casts(): array
    {
        return [
            'answered_at' => 'immutable_datetime',
        ];
    }

    public function checklistEntry(): BelongsTo
    {
        return $this->belongsTo(InspectionChecklistNode::class, 'checklist_entry_id');
    }

    public function inspection(): BelongsTo
    {
        return $this->belongsTo(VehicleInspection::class, 'inspection_id');
    }
}
