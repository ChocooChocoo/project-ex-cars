<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Generated from the final Supabase schema (table `message_reports`). Mass assignment stays closed until a phase adds $fillable for its actor.
class MessageReport extends Model
{
    use HasUuids;

    protected $table = 'message_reports';

    const UPDATED_AT = null;

    protected function casts(): array
    {
        return [
            'decision_date' => 'immutable_datetime',
        ];
    }

    public function reportedInquiry(): BelongsTo
    {
        return $this->belongsTo(Inquiry::class, 'reported_inquiry_id');
    }

    public function reportedMessage(): BelongsTo
    {
        return $this->belongsTo(InquiryMessage::class, 'reported_message_id');
    }

    public function reporter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reporter_id');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewer_id');
    }
}
