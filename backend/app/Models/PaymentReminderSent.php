<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Generated from the final Supabase schema (table `payment_reminders_sent`). Mass assignment stays closed until a phase adds $fillable for its actor.
class PaymentReminderSent extends Model
{
    protected $table = 'payment_reminders_sent';

    protected $primaryKey = null;

    public $incrementing = false;

    public $timestamps = false;

    protected function casts(): array
    {
        return [
            'days_before' => 'integer',
            'sent_at' => 'immutable_datetime',
        ];
    }

    public function installment(): BelongsTo
    {
        return $this->belongsTo(Installment::class, 'installment_id');
    }
}
