<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Generated from the final Supabase schema (table `vehicle_media`). Mass assignment stays closed until a phase adds $fillable for its actor.
class VehicleMedia extends Model
{
    use HasUuids;

    protected $table = 'vehicle_media';

    public $timestamps = false;

    protected function casts(): array
    {
        return [
            'display_order' => 'integer',
            'public_state' => 'boolean',
            'uploaded_at' => 'immutable_datetime',
        ];
    }

    public function uploadedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class, 'vehicle_id');
    }
}
