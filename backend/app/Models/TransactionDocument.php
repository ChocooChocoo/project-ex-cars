<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Generated from the final Supabase schema (table `transaction_documents`). Mass assignment stays closed until a phase adds $fillable for its actor.
class TransactionDocument extends Model
{
    public const BUYER_REQUIRED_KINDS = ['valid_id', 'proof_of_billing', 'payslip'];

    /**
     * SH-10: the kinds a customer may ever receive. `expense_proof` (the Confidential Informant's meet-up receipts)
     * and `inspection_photo` (the Mechanic's evidence) are staff-only and never leave the server for a customer.
     */
    public const CUSTOMER_KINDS = [
        ...self::BUYER_REQUIRED_KINDS, 'sell_photo', 'issue_photo', 'payment_receipt', 'sale_document',
        'sale_certificate', 'deed_of_sale', 'official_receipt', 'certificate_of_registration', 'orcr',
    ];

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
