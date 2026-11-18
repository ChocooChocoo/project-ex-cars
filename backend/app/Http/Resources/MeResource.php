<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * GET /api/v1/me. TypeScript twin: src/lib/api/types.ts `Me`.
 * Keys stay snake_case like the Supabase rows the React code already reads.
 *
 * @mixin \App\Models\User
 */
class MeResource extends JsonResource
{
    public static $wrap = null;

    public function toArray(Request $request): array
    {
        $p = $this->profile;

        return [
            'id' => $this->id,
            'email' => $this->email,
            'email_verified' => $this->hasVerifiedEmail(),
            'role' => $this->role()?->value,
            'profile' => [
                'full_name' => $p?->full_name,
                'phone' => $p?->phone,
                'address' => $p?->address,
                'address_line' => $p?->address_line,
                'region_code' => $p?->region_code,
                'province_code' => $p?->province_code,
                'city_code' => $p?->city_code,
                'barangay_code' => $p?->barangay_code,
                'avatar_url' => $p?->avatar_url,
                'account_state' => $p?->account_state,
                'tutorial_completed_at' => $p?->tutorial_completed_at?->toIso8601ZuluString('microsecond'),
            ],
        ];
    }
}
