<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Generated from the final Supabase schema (table `transaction_status_history`). Mass assignment stays closed until a phase adds $fillable for its actor.
class TransactionStatusHistory extends Model
{
    use HasUuids;

    protected $table = 'transaction_status_history';

    public $timestamps = false;

    protected function casts(): array
    {
        return [
            'changed_at' => 'immutable_datetime',
        ];
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }

    public function transaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class, 'transaction_id');
    }
}
