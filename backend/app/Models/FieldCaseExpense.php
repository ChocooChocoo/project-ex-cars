<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Generated from the final Supabase schema (table `field_case_expenses`). Mass assignment stays closed until a phase adds $fillable for its actor.
class FieldCaseExpense extends Model
{
    use HasUuids;

    protected $table = 'field_case_expenses';

    public $timestamps = false;

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'submitted_at' => 'immutable_datetime',
            'reimbursed_at' => 'immutable_datetime',
        ];
    }

    public function fieldCase(): BelongsTo
    {
        return $this->belongsTo(FieldCase::class, 'field_case_id');
    }

    public function proofDocument(): BelongsTo
    {
        return $this->belongsTo(TransactionDocument::class, 'proof_document_id');
    }

    public function reimbursedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reimbursed_by');
    }

    public function submittedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'submitted_by');
    }
}
