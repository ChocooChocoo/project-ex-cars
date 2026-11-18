<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Generated from the final Supabase schema (table `viewing_arrangements`). Mass assignment stays closed until a phase adds $fillable for its actor.
class ViewingArrangement extends Model
{
    use HasUuids;

    protected $table = 'viewing_arrangements';

    const UPDATED_AT = null;

    protected function casts(): array
    {
        return [
            'schedule' => 'immutable_datetime',
            'down_payment_amount' => 'decimal:2',
        ];
    }

    public function purchaseTransaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class, 'purchase_transaction_id');
    }

    public function confirmedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'confirmed_by');
    }

    public function inquiry(): BelongsTo
    {
        return $this->belongsTo(Inquiry::class, 'inquiry_id');
    }

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class, 'vehicle_id');
    }
}
