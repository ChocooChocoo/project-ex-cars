<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Generated from the final Supabase schema (table `vehicle_inspections`). Mass assignment stays closed until a phase adds $fillable for its actor.
class VehicleInspection extends Model
{
    use HasUuids;

    protected $table = 'vehicle_inspections';

    const UPDATED_AT = null;

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
}
