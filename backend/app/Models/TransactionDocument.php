<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Generated from the final Supabase schema (table `transaction_documents`). Mass assignment stays closed until a phase adds $fillable for its actor.
class TransactionDocument extends Model
{
    use HasUuids;

    protected $table = 'transaction_documents';

    public $timestamps = false;

    protected function casts(): array
    {
        return [
            'upload_date' => 'immutable_datetime',
            'auto_checked_at' => 'immutable_datetime',
        ];
    }

    public function transaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class, 'transaction_id');
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploader_id');
    }

    public function verifier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'verifier_id');
    }
}
