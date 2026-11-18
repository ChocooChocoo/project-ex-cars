<?php

namespace App\Http\Controllers\Messaging;

use App\Http\Controllers\Controller;
use App\Models\Inquiry;
use App\Models\InquiryMessage;
use App\Models\MessageAttachment;
use App\Models\MessageReport;
use App\Models\Profile;
use App\Models\User;
use App\Models\ViewingArrangement;
use App\Services\FileService;
use App\Support\ApiRow;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

/**
 * Inquiry threads, messages, attachments, read marks and reports (was my-inquiries/actions.ts, the staff
 * inquiry pages and the Supabase realtime channel). Every thread call is checked with InquiryPolicy::view.
 */
class InquiryController extends Controller
{
    /** Polls overlap by this much so a message committed late with an earlier sent_at is never skipped; the browser drops duplicates by id. */
    private const POLL_OVERLAP_SECONDS = 5;

    /** GET /inquiries: the caller's inbox with unread counts (customer: own; CEO/AM: all but sell threads; SM: buy threads). */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = Inquiry::query()->with('vehicle:id,make,model,year');
        match (true) {
            $user->hasRole('customer') => $query->where('customer_id', $user->id),
            $user->hasRole('ceo', 'account_manager') => $query->where('intention_kind', '!=', 'sell_negotiation'),
            $user->hasRole('sales_manager') => $query->whereIn('intention_kind', ['buy_now', 'buy_financing']),
            default => abort(403),
        };
        $inquiries = $query->orderByDesc('updated_at')->get();
        $names = $user->hasRole('customer') ? collect() : Profile::query()->whereIn('id', $inquiries->pluck('customer_id'))->pluck('full_name', 'id');

        $unread = InquiryMessage::query()->whereIn('inquiry_id', $inquiries->pluck('id'))->where('sender_id', '!=', $user->id)
            ->whereNull('read_at')->groupBy('inquiry_id')->selectRaw('inquiry_id, COUNT(*) AS n')->pluck('n', 'inquiry_id');

        return response()->json([
            'inquiries' => $inquiries->map(fn (Inquiry $i) => ApiRow::of($i) + [
                'vehicles' => ApiRow::of($i->vehicle, ['make', 'model', 'year']),
            ] + ($user->hasRole('customer') ? [] : ['profiles' => ['full_name' => $names[$i->customer_id] ?? null]]))->values(),
            'unread_by_inquiry' => (object) $unread->map(fn ($n) => (int) $n)->all(),
        ]);
    }

    /** GET /inquiries/{id}: thread with messages (signed attachments) and the latest arrangement. */
    public function show(Request $request, FileService $files, string $id): JsonResponse
    {
        $inquiry = $this->viewable($request, $id);
        $messages = InquiryMessage::query()->where('inquiry_id', $id)->orderBy('sent_at')->orderBy('id')->get();
        $arrangement = ViewingArrangement::query()->where('inquiry_id', $id)->orderByDesc('created_at')->first();

        return response()->json([
            'inquiry' => ApiRow::of($inquiry) + [
                'vehicles' => ApiRow::of($inquiry->vehicle, ['make', 'model', 'year', 'stock_code']),
                'profiles' => ['full_name' => Profile::query()->whereKey($inquiry->customer_id)->value('full_name')],
            ],
            'messages' => $this->messageRows($files, $messages),
            'arrangement' => ApiRow::of($arrangement),
            'cursor' => $this->cursor($messages),
        ]);
    }

    /**
     * GET /inquiries/{id}/messages?after=<cursor>: messages since the cursor (polling). The cursor is the
     * `sent_at` of the newest message the browser has; an empty or invalid cursor returns the whole thread.
     */
    public function messages(Request $request, FileService $files, string $id): JsonResponse
    {
        $this->viewable($request, $id);
        $query = InquiryMessage::query()->where('inquiry_id', $id);
        $after = $this->parseCursor($request->query('after'));
        if ($after) {
            $query->where('sent_at', '>=', $after->subSeconds(self::POLL_OVERLAP_SECONDS));
        }
        $messages = $query->orderBy('sent_at')->orderBy('id')->limit(200)->get();

        return response()->json([
            'messages' => $this->messageRows($files, $messages),
            'cursor' => $this->cursor($messages) ?? $after?->format('Y-m-d\TH:i:s.u\Z'),
        ]);
    }

    /** POST /inquiries/{id}/messages (multipart): text and/or one attachment, stored in one DB transaction. */
    public function storeMessage(Request $request, FileService $files, string $id): JsonResponse
    {
        $this->viewable($request, $id);
        $data = $request->validate([
            'message_text' => ['nullable', 'string', 'max:2000'],
            'attachment' => ['nullable', 'file'],
        ], ['message_text.max' => 'Message is too long.']);
        $text = trim((string) ($data['message_text'] ?? ''));
        $upload = $request->file('attachment');
        abort_if($text === '' && ! $upload, 422, 'Message cannot be empty');
        $name = $upload ? trim($upload->getClientOriginalName()) : '';
        if ($upload && ($name === '' || mb_strlen($name) > 200)) {
            abort(422, 'Rename the file to under 200 characters.');
        }

        // The key is generated server-side under the thread's folder; nothing in the request names a path.
        $stored = $upload ? $files->store($upload, 'message-attachments', $id, 'attachment') : null;
        try {
            [$message, $attachment] = DB::transaction(function () use ($request, $id, $text, $stored, $name) {
                $message = (new InquiryMessage)->forceFill([
                    'inquiry_id' => $id, 'sender_id' => $request->user()->id, 'message_text' => $text !== '' ? $text : null,
                    // Stamped with the same (PHP) clock the poll cursor is capped by.
                    'sent_at' => CarbonImmutable::now('UTC'),
                ]);
                $message->save();
                $attachment = null;
                if ($stored) {
                    $attachment = (new MessageAttachment)->forceFill([
                        'message_id' => $message->id,
                        'file_kind' => str_starts_with($stored['mime'], 'image/') ? 'image' : 'file',
                        'storage_path' => $stored['path'], 'original_name' => $name,
                        'file_size' => $stored['size'], 'uploader_id' => $request->user()->id,
                    ]);
                    $attachment->save();
                }
                Inquiry::query()->whereKey($id)->update(['updated_at' => now()]);

                return [$message->fresh(), $attachment?->fresh()];
            });
        } catch (\Throwable $e) {
            $files->delete('message-attachments', $stored['path'] ?? null);
            throw $e;
        }

        $row = $this->messageRows($files, collect([$message]))[0];

        return response()->json(['message' => $row, 'attachment' => $attachment ? $row['message_attachments'][0] : null], 201);
    }

    /** POST /inquiries/{id}/read: marks the other side's messages read. */
    public function markRead(Request $request, string $id): JsonResponse
    {
        $this->viewable($request, $id);
        $count = InquiryMessage::query()->where('inquiry_id', $id)->where('sender_id', '!=', $request->user()->id)
            ->whereNull('read_at')->update(['read_at' => now()]);

        return response()->json(['marked' => $count]);
    }

    /** GET /inquiries/unread-count: sidebar badge (CEO/AM/SM only, else 0), across threads the caller can read. */
    public function unreadTotal(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user->hasRole('ceo', 'account_manager', 'sales_manager')) {
            return response()->json(['count' => 0]);
        }
        $count = InquiryMessage::query()->where('sender_id', '!=', $user->id)->whereNull('read_at')
            ->whereHas('inquiry', fn (Builder $q) => $user->hasRole('sales_manager') ? $q->whereIn('intention_kind', ['buy_now', 'buy_financing']) : $q)
            ->count();

        return response()->json(['count' => $count]);
    }

    /** POST /inquiries/{id}/reports: a participant reports a message or the conversation. */
    public function report(Request $request, string $id): JsonResponse
    {
        $this->viewable($request, $id);
        $data = $request->validate([
            'message_id' => ['nullable', 'uuid', 'exists:inquiry_messages,id,inquiry_id,'.$id],
            'reason' => ['required', 'string', 'min:1', 'max:1000'],
        ]);
        (new MessageReport)->forceFill([
            'reported_message_id' => $data['message_id'] ?? null, 'reported_inquiry_id' => $id,
            'reporter_id' => $request->user()->id, 'reason' => $data['reason'],
        ])->save();

        return response()->json(['success' => true], 201);
    }

    /** GET /staff/message-reports (CEO/AM): reports with the reporter's email and the inquiry. */
    public function reports(): JsonResponse
    {
        $reports = MessageReport::query()->orderByDesc('created_at')->get();
        $emails = User::query()->whereIn('id', $reports->pluck('reporter_id'))->pluck('email', 'id');
        $inquiries = Inquiry::query()->with('vehicle:id,make,model')->whereIn('id', $reports->pluck('reported_inquiry_id')->filter())->get()->keyBy('id');

        return response()->json($reports->map(function (MessageReport $r) use ($emails, $inquiries) {
            $inquiry = $inquiries[$r->reported_inquiry_id] ?? null;

            return ApiRow::of($r) + [
                'reporter' => ['email' => $emails[$r->reporter_id] ?? null],
                'inquiry' => $inquiry ? ApiRow::of($inquiry) + ['vehicles' => ApiRow::of($inquiry->vehicle, ['make', 'model'])] : null,
            ];
        })->values());
    }

    private function viewable(Request $request, string $id): Inquiry
    {
        $inquiry = Inquiry::query()->with('vehicle:id,make,model,year,stock_code')->findOrFail($id);
        // Not found rather than forbidden, so ids of other people's threads are not confirmed.
        abort_unless(Gate::forUser($request->user())->allows('view', $inquiry), 404, 'Resource not found.');

        return $inquiry;
    }

    /** `*` plus `message_attachments`, each signed for one hour; the storage path never leaves the API. */
    private function messageRows(FileService $files, Collection $messages): array
    {
        $attachments = MessageAttachment::query()->whereIn('message_id', $messages->pluck('id'))->orderBy('uploaded_at')->get()->groupBy('message_id');

        return $messages->map(fn (InquiryMessage $m) => ApiRow::of($m) + [
            'message_attachments' => ($attachments[$m->id] ?? collect())->map(fn (MessageAttachment $a) => array_diff_key(ApiRow::of($a), ['storage_path' => 1]) + [
                'signed_url' => $files->signedUrl('message-attachments', $a->storage_path),
            ])->values()->all(),
        ])->values()->all();
    }

    /** Never ahead of the server clock: a future-dated row (clock skew, old seeds) must not hide new messages. */
    private function cursor(Collection $messages): ?string
    {
        $last = $messages->last()?->sent_at;

        return $last ? $last->min(CarbonImmutable::now('UTC'))->format('Y-m-d\TH:i:s.u\Z') : null;
    }

    private function parseCursor(mixed $value): ?CarbonImmutable
    {
        if (! is_string($value) || ! preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?Z$/', $value)) {
            return null;
        }

        return CarbonImmutable::parse($value, 'UTC')->min(CarbonImmutable::now('UTC'));
    }
}
