<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Generated from the final Supabase schema (table `disbursement_events`). Mass assignment stays closed until a phase adds $fillable for its actor.
class DisbursementEvent extends Model
{
    use HasUuids;

    protected $table = 'disbursement_events';

    const UPDATED_AT = null;

    public function actor(): BelongsTo
    {
        return $this->belongsTo(Profile::class, 'actor_id');
    }

    public function disbursement(): BelongsTo
    {
        return $this->belongsTo(DisbursementRequest::class, 'disbursement_id');
    }
}
