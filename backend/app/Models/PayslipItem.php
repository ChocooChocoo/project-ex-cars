<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Generated from the final Supabase schema (table `payslip_items`). Mass assignment stays closed until a phase adds $fillable for its actor.
class PayslipItem extends Model
{
    use HasUuids;

    protected $table = 'payslip_items';

    const UPDATED_AT = null;

    protected function casts(): array
    {
        return [
            'amount_cents' => 'integer',
        ];
    }

    public function payslip(): BelongsTo
    {
        return $this->belongsTo(Payslip::class, 'payslip_id');
    }
}
