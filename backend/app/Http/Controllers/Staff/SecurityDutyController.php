<?php

namespace App\Http\Controllers\Staff;

use App\Http\Controllers\Controller;
use App\Services\FileService;
use App\Services\Trading\Trading;
use App\Support\ApiRow;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Security duty checks (was src/app/(staff)/security-duty-checks). Policy gap 4 closed: the old RLS gave any role
 * full access to rows with its own security_id; now only Head Security writes and reads their own checks and the
 * CEO reads all (the two roles the page serves). Evidence photos go to the private security-evidence bucket.
 */
class SecurityDutyController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $rows = DB::table('security_duty_checks')->when($user->hasRole('head_security'), fn ($q) => $q->where('security_id', $user->id))
            ->orderByDesc('duty_date')->get();

        return response()->json([
            'canManage' => $user->hasRole('head_security'),
            'checks' => $rows->map(fn ($c) => [
                'id' => $c->id, 'security_id' => $c->security_id, 'duty_date' => $c->duty_date, 'before_image_path' => $c->before_image_path,
                'after_image_path' => $c->after_image_path, 'notes' => $c->notes, 'status' => $c->status, 'completed_at' => ApiRow::iso($c->completed_at),
            ]),
        ]);
    }

    public function start(Request $request): JsonResponse
    {
        $data = $request->validate(['duty_date' => ['required', 'date_format:Y-m-d'], 'notes' => ['nullable', 'string', 'max:1000']], ['duty_date.*' => 'Duty date is required.']);
        try {
            DB::table('security_duty_checks')->insert([
                'id' => (string) Str::uuid(), 'security_id' => $request->user()->id, 'duty_date' => $data['duty_date'],
                'notes' => ($data['notes'] ?? '') === '' ? null : $data['notes'], 'status' => 'in_progress', 'created_at' => now(), 'updated_at' => now(),
            ]);
        } catch (\Throwable $e) {
            abort_if(Trading::isUnique($e, 'uq_security_duty_date'), 409, 'A duty check already exists for this date.');
            throw $e;
        }

        return response()->json(['success' => true]);
    }

    public function upload(Request $request, FileService $files): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate(['duty_check_id' => ['required', 'uuid'], 'slot' => ['required', 'in:before,after'], 'image' => ['required', 'file']],
            ['image.*' => 'No image file provided.']);
        $check = DB::table('security_duty_checks')->where('id', $data['duty_check_id'])->where('security_id', $user->id)->first();
        abort_unless($check, 404, 'Duty check not found.');
        $stored = $files->store($request->file('image'), 'security-evidence', $user->id, 'image');
        $column = $data['slot'] === 'before' ? 'before_image_path' : 'after_image_path';
        DB::table('security_duty_checks')->where('id', $check->id)->update([$column => $stored['path'], 'status' => 'in_progress', 'updated_at' => now()]);
        $files->delete('security-evidence', $check->{$column});

        return response()->json(['success' => true]);
    }

    public function complete(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate(['duty_check_id' => ['required', 'uuid'], 'notes' => ['nullable', 'string', 'max:1000']]);
        $check = DB::table('security_duty_checks')->where('id', $data['duty_check_id'])->where('security_id', $user->id)->first();
        abort_unless($check, 404, 'Duty check not found.');
        abort_unless($check->before_image_path && $check->after_image_path, 422, 'Both before and after images are required to complete the check.');
        DB::table('security_duty_checks')->where('id', $check->id)->update([
            'status' => 'completed', 'completed_at' => now(), 'notes' => ($data['notes'] ?? '') !== '' ? $data['notes'] : $check->notes, 'updated_at' => now(),
        ]);

        return response()->json(['success' => true]);
    }
}
