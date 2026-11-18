<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Generated from the final Supabase schema (table `inquiries`). Mass assignment stays closed until a phase adds $fillable for its actor.
class Inquiry extends Model
{
    use HasUuids;

    protected $table = 'inquiries';

    public function assignedAccountManager(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_account_manager');
    }

    public function assignedSalesManager(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_sales_manager');
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Profile::class, 'customer_id');
    }

    public function transaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class, 'transaction_id');
    }

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class, 'vehicle_id');
    }
}
