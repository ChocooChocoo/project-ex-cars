<?php

namespace App\Http\Controllers;

use App\Enums\Role;
use App\Models\User;
use App\Services\AccountService;
use App\Support\Rules;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Staff-created accounts and role grants. The actor is always the session user. */
class AccountAdminController extends Controller
{
    public function __construct(private AccountService $accounts) {}

    /** AM/CEO: a verified customer account for a walk-in buyer. */
    public function storeWalkIn(Request $request): JsonResponse
    {
        $data = $this->validateAccount($request);
        $user = $this->accounts->create($data['email'], $data['password'], trim($data['full_name']), Role::Customer, $request->user(), verified: true, auditAction: 'walk_in_account_created');

        return response()->json(['id' => $user->id], 201);
    }

    /** T04 E6, CEO/AM: a new employee account with its role and default work schedule. */
    public function storeEmployee(Request $request): JsonResponse
    {
        $data = $this->validateAccount($request, ['role' => ['required', Rule::in(Role::EMPLOYEE)]]);
        $user = $this->accounts->create($data['email'], $data['password'], trim($data['full_name']), Role::from($data['role']), $request->user(), verified: true, auditAction: 'employee_account_created');

        return response()->json(['id' => $user->id], 201);
    }

    /** T03 R2 / T06: CEO and Super Admin grant roles. */
    public function assignRole(Request $request): JsonResponse
    {
        $data = $request->validate([
            'account_id' => ['required', 'uuid', 'exists:users,id'],
            'role' => ['required', Rule::in(Role::values())],
        ]);
        $this->accounts->assignRole(User::query()->findOrFail($data['account_id']), Role::from($data['role']), $request->user());

        return response()->json(['ok' => true]);
    }

    private function validateAccount(Request $request, array $extra = []): array
    {
        return $request->validate([
            'full_name' => Rules::fullName(),
            'email' => [...Rules::email(), 'unique:users,email'],
            'password' => Rules::newPassword(),
            ...$extra,
        ], [...Rules::messages(), 'email.unique' => 'A user with this email address has already been registered', 'role.*' => 'Choose a staff role.']);
    }
}
