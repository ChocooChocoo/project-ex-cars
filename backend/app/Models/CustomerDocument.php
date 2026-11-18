<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Generated from the final Supabase schema (table `customer_documents`). Mass assignment stays closed until a phase adds $fillable for its actor.
class CustomerDocument extends Model
{
    use HasUuids;

    protected $table = 'customer_documents';

    const UPDATED_AT = null;

    protected function casts(): array
    {
        return [
            'verified_at' => 'immutable_datetime',
        ];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Profile::class, 'customer_id');
    }

    public function verifiedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'verified_by');
    }
}
