<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Generated from the final Supabase schema (table `reconditioning_parts`). Mass assignment stays closed until a phase adds $fillable for its actor.
class ReconditioningPart extends Model
{
    use HasUuids;

    protected $table = 'reconditioning_parts';

    protected function casts(): array
    {
        return [
            'estimated_cost_cents' => 'integer',
            'actual_cost_cents' => 'integer',
        ];
    }

    public function job(): BelongsTo
    {
        return $this->belongsTo(ReconditioningJob::class, 'job_id');
    }
}
