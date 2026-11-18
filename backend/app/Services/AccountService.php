<?php

namespace App\Services;

use App\Enums\Role;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Creates accounts in one transaction: user + profile + role (+ work schedule for staff) + audit.
 * Replaces the Supabase handle_new_user / handle_new_user_role triggers and the admin-API
 * create-then-delete-on-failure dance in src/app/auth/actions.ts.
 */
class AccountService
{
    public function create(string $email, string $password, string $fullName, Role $role, ?User $actor, bool $verified, ?string $auditAction = null): User
    {
        return DB::transaction(function () use ($email, $password, $fullName, $role, $actor, $verified, $auditAction) {
            $user = new User(['email' => strtolower($email), 'password' => $password]);
            $user->email_verified_at = $verified ? now() : null;
            $user->save();

            DB::table('profiles')->insert([
                'id' => $user->id,
                'full_name' => $fullName,
                'account_state' => 'active',
                'created_by' => $actor?->id,
                'activated_at' => now(),
            ]);
            DB::table('user_roles')->insert(['account_id' => $user->id, 'role' => $role->value, 'active' => true, 'assigned_by' => $actor?->id]);

            // Staff-created employees get their role's default schedule (created_by is required, so seeds/tests without an actor skip it).
            if ($actor && in_array($role->value, Role::EMPLOYEE, true) && $schedule = $this->defaultSchedule($role)) {
                DB::table('employee_work_schedules')->insert([
                    'employee_id' => $user->id,
                    'workdays' => json_encode($schedule['workdays']),
                    'start_time' => $schedule['start_time'],
                    'end_time' => $schedule['end_time'],
                    'grace_minutes' => $schedule['grace_minutes'],
                    'timezone' => $schedule['timezone'],
                    'created_by' => $actor->id,
                    'updated_by' => $actor->id,
                ]);
            }

            if ($auditAction && $actor) {
                $summary = match ($auditAction) {
                    'walk_in_account_created' => "Walk-in account created for {$fullName} ({$email})",
                    default => "{$role->label()} account created for {$fullName} ({$email})",
                };
                $this->audit($actor, $auditAction, 'profile', $user->id, $summary);
            }

            return $user;
        });
    }

    public function assignRole(User $target, Role $role, User $actor): void
    {
        DB::transaction(function () use ($target, $role, $actor) {
            DB::table('user_roles')->updateOrInsert(
                ['account_id' => $target->id],
                ['role' => $role->value, 'active' => true, 'assigned_by' => $actor->id, 'assigned_at' => now()],
            );
            $this->audit($actor, 'role_assigned', 'user_role', $target->id, "Role '{$role->value}' assigned to account {$target->id}");
        });
    }

    public function audit(User $actor, string $action, string $kind, string $recordId, string $summary): void
    {
        DB::table('audit_events')->insert(['actor_id' => $actor->id, 'action' => $action, 'record_kind' => $kind, 'record_id' => $recordId, 'summary' => $summary]);
    }

    /** Shared with the Next.js app: src/lib/attendance/role-schedules.json. */
    private function defaultSchedule(Role $role): ?array
    {
        static $schedules;
        $schedules ??= json_decode(file_get_contents(base_path('../src/lib/attendance/role-schedules.json')), true);

        return $schedules[$role->value] ?? null;
    }
}
