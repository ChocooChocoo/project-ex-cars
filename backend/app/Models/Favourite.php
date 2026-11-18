<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Generated from the final Supabase schema (table `favourites`). Mass assignment stays closed until a phase adds $fillable for its actor.
class Favourite extends Model
{
    use HasUuids;

    protected $table = 'favourites';

    public $timestamps = false;

    protected function casts(): array
    {
        return [
            'saved_at' => 'immutable_datetime',
        ];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Profile::class, 'customer_id');
    }

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class, 'vehicle_id');
    }
}
