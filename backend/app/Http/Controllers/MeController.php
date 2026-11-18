<?php

namespace App\Http\Controllers;

use App\Http\Resources\MeResource;
use App\Notifications\ConfirmEmailChange;
use App\Services\FileService;
use App\Support\Rules;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\Rule;

/** The signed-in user's own account. Every write targets $request->user(); no id comes from the request. */
class MeController extends Controller
{
    public function show(Request $request): MeResource
    {
        return new MeResource($request->user());
    }

    /** T05 own profile. Next.js composes `address` from the PSGC names it holds; Laravel checks the stored columns. */
    public function updateProfile(Request $request): MeResource
    {
        $psgc = ['nullable', 'regex:/^\d{9}$/'];
        $data = $request->validate([
            'full_name' => Rules::fullName(),
            'phone' => ['nullable', 'string', 'min:10', 'max:15', 'regex:/^(\+63|0)?\d{10}$/'],
            'address' => ['nullable', 'string', 'max:500'],
            'address_line' => ['nullable', 'string', 'max:200'],
            'region_code' => ['required', 'regex:/^\d{9}$/'],
            'province_code' => $psgc,
            'city_code' => ['required', 'regex:/^\d{9}$/'],
            'barangay_code' => ['required', 'regex:/^\d{9}$/'],
        ], [
            ...Rules::messages(),
            'phone.regex' => 'Phone must be a valid Philippine number.',
            'region_code.*' => 'Choose your region.',
            'province_code.*' => 'Choose a province from the list.',
            'city_code.*' => 'Choose your city or municipality.',
            'barangay_code.*' => 'Choose your barangay.',
        ]);

        $user = $request->user();
        DB::table('profiles')->where('id', $user->id)->update(['full_name' => trim($data['full_name'])] + $data);

        return new MeResource($user->fresh());
    }

    public function updatePassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'current_password' => ['required', 'current_password:web'],
            'new_password' => [...Rules::newPassword(), 'different:current_password'],
        ], [
            ...Rules::messages('new_password'),
            'current_password.required' => 'Enter your current password.',
            'current_password.current_password' => 'Your current password is not correct.',
            'new_password.different' => 'Choose a password different from the current one.',
        ]);

        $user = $request->user();
        $user->forceFill(['password' => $data['new_password'], 'remember_token' => null])->save();
        // Sign out this account's other browsers (database sessions); keep this one on a fresh id.
        $request->session()->regenerate();
        DB::table('sessions')->where('user_id', $user->id)->where('id', '!=', $request->session()->getId())->delete();

        return response()->json(['ok' => true]);
    }

    /** Test sheet #4 (C15): customers change their own email; staff emails stay managed by AM/CEO. */
    public function requestEmailChange(Request $request): JsonResponse
    {
        $user = $request->user();
        $email = strtolower(trim((string) $request->input('email')));
        $request->merge(['email' => $email])->validate([
            'email' => [...Rules::email(), Rule::notIn([strtolower($user->email)]), Rule::unique('users', 'email')],
        ], [
            ...Rules::messages(),
            'email.not_in' => 'This is already your email.',
            'email.unique' => 'This email is already used by another account.',
        ]);

        Notification::route('mail', $email)->notify(new ConfirmEmailChange($user->id, $email));

        return response()->json(['ok' => true, 'email' => $email]);
    }

    public function completeTutorial(Request $request): JsonResponse
    {
        DB::table('profiles')->where('id', $request->user()->id)->whereNull('tutorial_completed_at')->update(['tutorial_completed_at' => now()]);

        return response()->json(['ok' => true]);
    }

    /** Test sheet #4 (C15): own profile photo on the public `avatars` bucket, under avatars/<user id>/. */
    public function updateAvatar(Request $request, FileService $files): MeResource
    {
        $request->validate(['avatar' => ['required', 'file']], ['avatar.required' => 'Choose a photo to upload.']);
        $user = $request->user();
        $stored = $files->store($request->file('avatar'), 'avatars', $user->id, 'avatar');
        $this->replaceAvatar($files, $user->id, $files->publicUrl('avatars', $stored['path']));

        return new MeResource($user->fresh());
    }

    public function removeAvatar(Request $request, FileService $files): MeResource
    {
        $this->replaceAvatar($files, $request->user()->id, null);

        return new MeResource($request->user()->fresh());
    }

    private function replaceAvatar(FileService $files, string $userId, ?string $url): void
    {
        $old = DB::table('profiles')->where('id', $userId)->value('avatar_url');
        DB::table('profiles')->where('id', $userId)->update(['avatar_url' => $url]);
        // Delete the previous photo only when it is one of ours and inside this user's own folder.
        $base = $files->publicUrl('avatars', '');
        if (is_string($old) && str_starts_with($old, $base.$userId.'/')) {
            $files->delete('avatars', substr($old, strlen($base)));
        }
    }
}
