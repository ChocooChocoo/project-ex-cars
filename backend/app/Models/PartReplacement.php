<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Generated from the final Supabase schema (table `part_replacements`). Mass assignment stays closed until a phase adds $fillable for its actor.
class PartReplacement extends Model
{
    use HasUuids;

    protected $table = 'part_replacements';

    public $timestamps = false;

    protected function casts(): array
    {
        return [
            'estimated_cost' => 'decimal:2',
            'recorded_at' => 'immutable_datetime',
        ];
    }

    public function checklistAnswer(): BelongsTo
    {
        return $this->belongsTo(InspectionChecklistResult::class, 'checklist_answer_id');
    }
}
