<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Generated from the final Supabase schema (table `inspection_checklist_nodes`). Mass assignment stays closed until a phase adds $fillable for its actor.
class InspectionChecklistNode extends Model
{
    use HasUuids;

    protected $table = 'inspection_checklist_nodes';

    const UPDATED_AT = null;

    protected function casts(): array
    {
        return [
            'display_order' => 'integer',
            'active' => 'boolean',
        ];
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(InspectionChecklistNode::class, 'parent_id');
    }
}
