<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Generated from the final Supabase schema (table `roadmap_items`). Mass assignment stays closed until a phase adds $fillable for its actor.
class RoadmapItem extends Model
{
    use HasUuids;

    protected $table = 'roadmap_items';

    protected function casts(): array
    {
        return [
            'year' => 'integer',
            'start_date' => 'date:Y-m-d',
            'end_date' => 'date:Y-m-d',
        ];
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(Profile::class, 'created_by');
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(RoadmapItem::class, 'parent_id');
    }
}
