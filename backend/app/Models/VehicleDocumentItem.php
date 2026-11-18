<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Generated from the final Supabase schema (table `vehicle_document_items`). Mass assignment stays closed until a phase adds $fillable for its actor.
class VehicleDocumentItem extends Model
{
    use HasUuids;

    protected $table = 'vehicle_document_items';

    const UPDATED_AT = null;

    protected function casts(): array
    {
        return [
            'required_state' => 'boolean',
            'checked_at' => 'immutable_datetime',
        ];
    }

    public function checker(): BelongsTo
    {
        return $this->belongsTo(User::class, 'checker_id');
    }

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class, 'vehicle_id');
    }
}
