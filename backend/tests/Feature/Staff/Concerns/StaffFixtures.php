<?php

namespace Tests\Feature\Staff\Concerns;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Feature\Auth\Concerns\MakesAccounts;

trait StaffFixtures
{
    use MakesAccounts;

    /** Inside the GCE geofence, good accuracy. */
    protected const AT_GCE = ['lat' => 14.3274076, 'lng' => 120.9535899, 'accuracy' => 12];

    protected function act(User $user): static
    {
        return $this->as($user)->withHeaders(['Accept' => 'application/json']);
    }

    /** A staff account with its role's default schedule (role-schedules.json), as a CEO-created employee gets. */
    protected function employee(string $role): User
    {
        $user = $this->account($role);
        $schedule = json_decode(file_get_contents(base_path('../src/lib/attendance/role-schedules.json')), true)[$role];
        DB::table('employee_work_schedules')->insert([
            'id' => (string) Str::uuid(), 'employee_id' => $user->id, 'workdays' => json_encode($schedule['workdays']),
            'start_time' => $schedule['start_time'], 'end_time' => $schedule['end_time'], 'grace_minutes' => $schedule['grace_minutes'],
            'timezone' => $schedule['timezone'], 'created_by' => $user->id, 'updated_by' => $user->id, 'created_at' => now(), 'updated_at' => now(),
        ]);

        return $user;
    }
}
