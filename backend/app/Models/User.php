<?php

namespace App\Models;

use App\Enums\Role;
use App\Notifications\VerifyEmailOnFrontend;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

// Replaces Supabase auth.users. Profile data (full_name etc.) stays in `profiles`.
#[Fillable(['email', 'password'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable implements MustVerifyEmail
{
    use HasUuids, Notifiable;

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    public function profile(): HasOne
    {
        return $this->hasOne(Profile::class, 'id');
    }

    public function roleAssignment(): HasOne
    {
        return $this->hasOne(UserRole::class, 'account_id');
    }

    /** The account's active role, or null (no row, or the row is inactive). */
    public function role(): ?Role
    {
        $assignment = $this->roleAssignment;

        return $assignment && $assignment->active ? Role::tryFrom($assignment->role) : null;
    }

    public function hasRole(string ...$roles): bool
    {
        return in_array($this->role()?->value, $roles, true);
    }

    public function isActive(): bool
    {
        return $this->profile?->account_state === 'active' && $this->role() !== null;
    }

    public function sendEmailVerificationNotification(): void
    {
        $this->notify(new VerifyEmailOnFrontend);
    }
}
