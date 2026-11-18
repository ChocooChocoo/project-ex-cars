<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Generated from the final Supabase schema (table `inquiry_messages`). Mass assignment stays closed until a phase adds $fillable for its actor.
class InquiryMessage extends Model
{
    use HasUuids;

    protected $table = 'inquiry_messages';

    public $timestamps = false;

    protected function casts(): array
    {
        return [
            'sent_at' => 'immutable_datetime',
            'read_at' => 'immutable_datetime',
        ];
    }

    public function inquiry(): BelongsTo
    {
        return $this->belongsTo(Inquiry::class, 'inquiry_id');
    }

    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sender_id');
    }
}
