<?php

namespace Tests\Feature\Messaging;

use App\Models\Inquiry;
use App\Models\InquiryMessage;
use App\Models\Notification;
use App\Models\User;
use App\Models\Vehicle;
use App\Services\NotificationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Auth\Concerns\MakesAccounts;
use Tests\Feature\Catalogue\CatalogueTest;
use Tests\TestCase;

/** Inquiry threads, polling, attachments, unread counts, reports and notifications (Phase 4). */
class InquiryTest extends TestCase
{
    use MakesAccounts, RefreshDatabase;

    private function inquiry(User $customer, string $kind = 'inquiry'): Inquiry
    {
        $vehicle = (new Vehicle)->forceFill(['stock_code' => 'GCE-'.Str::random(6), 'make' => 'Toyota', 'model' => 'Vios', 'year' => 2020, 'listing_state' => 'available']);
        $vehicle->save();
        $inquiry = (new Inquiry)->forceFill(['customer_id' => $customer->id, 'vehicle_id' => $vehicle->id, 'intention_kind' => $kind]);
        $inquiry->save();

        return $inquiry->fresh();
    }

    private function message(Inquiry $inquiry, User $sender, string $text, ?string $sentAt = null): InquiryMessage
    {
        $message = (new InquiryMessage)->forceFill(['inquiry_id' => $inquiry->id, 'sender_id' => $sender->id, 'message_text' => $text] + ($sentAt ? ['sent_at' => $sentAt] : []));
        $message->save();

        return $message->fresh();
    }

    #[Test]
    public function a_customer_cannot_read_poll_post_or_report_in_another_customers_thread(): void
    {
        [$a, $b] = [$this->account('customer'), $this->account('customer')];
        $thread = $this->inquiry($a);
        $this->message($thread, $a, 'hello');

        $this->as($b)->getJson("/api/v1/inquiries/{$thread->id}")->assertNotFound();
        $this->as($b)->getJson("/api/v1/inquiries/{$thread->id}/messages")->assertNotFound();
        $this->as($b)->postJson("/api/v1/inquiries/{$thread->id}/messages", ['message_text' => 'x'])->assertNotFound();
        $this->as($b)->postJson("/api/v1/inquiries/{$thread->id}/read")->assertNotFound();
        $this->as($b)->postJson("/api/v1/inquiries/{$thread->id}/reports", ['reason' => 'x'])->assertNotFound();
        $this->as($b)->getJson('/api/v1/inquiries')->assertOk()->assertJsonCount(0, 'inquiries');

        $this->as($a)->getJson("/api/v1/inquiries/{$thread->id}")->assertOk()->assertJsonPath('messages.0.message_text', 'hello');
        $this->as($a)->getJson('/api/v1/inquiries')->assertJsonCount(1, 'inquiries');
    }

    #[Test]
    public function staff_see_threads_by_role(): void
    {
        $customer = $this->account('customer');
        $buy = $this->inquiry($customer, 'buy_now');
        $sell = $this->inquiry($customer, 'sell_negotiation');
        $plain = $this->inquiry($customer);

        $sm = $this->account('sales_manager');
        $this->as($sm)->getJson("/api/v1/inquiries/{$buy->id}")->assertOk()->assertJsonPath('inquiry.profiles.full_name', 'Customer Tester');
        $this->as($sm)->getJson("/api/v1/inquiries/{$plain->id}")->assertNotFound();
        $this->as($sm)->getJson('/api/v1/inquiries')->assertJsonCount(1, 'inquiries');
        $this->as($this->account('marketing_specialist'))->getJson("/api/v1/inquiries/{$sell->id}")->assertOk();
        $this->as($this->account('marketing_specialist'))->getJson('/api/v1/inquiries')->assertForbidden();
        $this->as($this->account('mechanic'))->getJson("/api/v1/inquiries/{$buy->id}")->assertNotFound();
        $this->as($this->account('ceo'))->getJson('/api/v1/inquiries')->assertJsonCount(2, 'inquiries'); // sell threads open from the offer
    }

    #[Test]
    public function polling_returns_messages_since_the_cursor_with_a_small_overlap(): void
    {
        $this->travelTo(\Carbon\CarbonImmutable::parse('2026-11-18 12:00:00', 'UTC'));
        $customer = $this->account('customer');
        $thread = $this->inquiry($customer);
        $this->message($thread, $customer, 'old', '2026-11-18 10:00:00.000000');
        $this->message($thread, $customer, 'recent', '2026-11-18 10:00:58.000000');

        $first = $this->as($customer)->getJson("/api/v1/inquiries/{$thread->id}")->assertOk();
        $cursor = $first->json('cursor');
        $this->assertSame('2026-11-18T10:00:58.000000Z', $cursor);

        $this->message($thread, $customer, 'new', '2026-11-18 10:01:30.000000');
        $poll = $this->as($customer)->getJson("/api/v1/inquiries/{$thread->id}/messages?after=".urlencode($cursor))->assertOk();
        // 'recent' is inside the 5 s overlap (the browser drops it by id); 'old' is not resent.
        $this->assertSame(['recent', 'new'], array_column($poll->json('messages'), 'message_text'));
        $this->assertSame('2026-11-18T10:01:30.000000Z', $poll->json('cursor'));

        $idle = $this->as($customer)->getJson("/api/v1/inquiries/{$thread->id}/messages?after=2026-11-18T11:00:00.000000Z")->assertOk();
        $this->assertSame([], $idle->json('messages'));
        $this->assertSame('2026-11-18T11:00:00.000000Z', $idle->json('cursor'));
    }

    #[Test]
    public function a_cursor_ahead_of_the_server_clock_does_not_hide_new_messages(): void
    {
        $this->travelTo(\Carbon\CarbonImmutable::parse('2026-11-18 12:00:00', 'UTC'));
        $customer = $this->account('customer');
        $thread = $this->inquiry($customer);
        $this->message($thread, $customer, 'future-dated', '2026-11-23 07:00:00.000000'); // skewed clock or old seed

        $first = $this->as($customer)->getJson("/api/v1/inquiries/{$thread->id}")->assertOk();
        $this->assertSame('2026-11-18T12:00:00.000000Z', $first->json('cursor'));

        $this->travelTo(\Carbon\CarbonImmutable::parse('2026-11-18 12:00:10', 'UTC'));
        $this->message($thread, $customer, 'sent now', '2026-11-18 12:00:10.000000');
        // The browser polls a while later (offline, backoff): the gap is longer than the overlap window.
        $this->travelTo(\Carbon\CarbonImmutable::parse('2026-11-18 12:00:30', 'UTC'));
        $poll = $this->as($customer)->getJson("/api/v1/inquiries/{$thread->id}/messages?after=2026-11-23T07:00:00.000000Z")->assertOk();
        $this->assertContains('sent now', array_column($poll->json('messages'), 'message_text'));
        $this->assertSame('2026-11-18T12:00:30.000000Z', $poll->json('cursor'));
    }

    #[Test]
    public function a_message_with_an_attachment_is_stored_signed_and_never_exposes_its_path(): void
    {
        Storage::fake('local');
        $customer = $this->account('customer');
        $thread = $this->inquiry($customer);
        $file = UploadedFile::fake()->createWithContent('odometer.png', CatalogueTest::png());

        $sent = $this->as($customer)->post("/api/v1/inquiries/{$thread->id}/messages", ['message_text' => 'see photo', 'attachment' => $file, 'attachment_path' => 'other/x.png'], ['Accept' => 'application/json'])->assertCreated();
        $attachment = $sent->json('attachment');
        $this->assertSame('odometer.png', $attachment['original_name']);
        $this->assertSame('image', $attachment['file_kind']);
        $this->assertArrayNotHasKey('storage_path', $attachment);
        $this->assertStringContainsString('/api/v1/files/message-attachments/'.$thread->id.'/', $attachment['signed_url']);
        $this->assertCount(1, Storage::disk('local')->allFiles("message-attachments/{$thread->id}"));

        $link = parse_url($attachment['signed_url']);
        $this->get($link['path'].'?'.$link['query'])->assertOk();

        $bad = UploadedFile::fake()->createWithContent('x.png', 'not an image');
        $this->as($customer)->post("/api/v1/inquiries/{$thread->id}/messages", ['attachment' => $bad], ['Accept' => 'application/json'])->assertStatus(422);
        $this->as($customer)->postJson("/api/v1/inquiries/{$thread->id}/messages", ['message_text' => '  '])->assertStatus(422);
        $this->assertSame(1, InquiryMessage::query()->count());
    }

    #[Test]
    public function unread_counts_and_read_marks(): void
    {
        $customer = $this->account('customer');
        $am = $this->account('account_manager');
        $thread = $this->inquiry($customer, 'buy_now');
        $this->message($thread, $customer, 'one');
        $this->message($thread, $customer, 'two');
        $this->message($thread, $am, 'reply');

        $this->as($am)->getJson('/api/v1/inquiries')->assertJsonPath("unread_by_inquiry.{$thread->id}", 2);
        $this->as($am)->getJson('/api/v1/inquiries/unread-count')->assertJson(['count' => 2]);
        $this->as($customer)->getJson('/api/v1/inquiries/unread-count')->assertJson(['count' => 0]);
        $this->as($customer)->getJson('/api/v1/inquiries')->assertJsonPath("unread_by_inquiry.{$thread->id}", 1);

        $this->as($am)->postJson("/api/v1/inquiries/{$thread->id}/read")->assertJson(['marked' => 2]);
        $this->as($am)->getJson('/api/v1/inquiries/unread-count')->assertJson(['count' => 0]);
        $this->assertNull(InquiryMessage::query()->where('message_text', 'reply')->value('read_at'));
    }

    #[Test]
    public function reports_are_tied_to_the_thread_and_listed_for_ceo_and_am_only(): void
    {
        $customer = $this->account('customer');
        $thread = $this->inquiry($customer);
        $other = $this->inquiry($this->account('customer'));
        $foreign = $this->message($other, $customer, 'elsewhere');
        $mine = $this->message($thread, $customer, 'rude');

        $this->as($customer)->postJson("/api/v1/inquiries/{$thread->id}/reports", ['message_id' => $foreign->id, 'reason' => 'x'])->assertStatus(422);
        $this->as($customer)->postJson("/api/v1/inquiries/{$thread->id}/reports", ['message_id' => $mine->id, 'reason' => 'spam'])->assertCreated();

        $this->as($this->account('sales_manager'))->getJson('/api/v1/staff/message-reports')->assertForbidden();
        $list = $this->as($this->account('ceo'))->getJson('/api/v1/staff/message-reports')->assertOk();
        $this->assertSame($customer->email, $list->json('0.reporter.email'));
        $this->assertSame('Toyota', $list->json('0.inquiry.vehicles.make'));
    }

    #[Test]
    public function notifications_are_scoped_to_the_callers_role_or_account(): void
    {
        $service = app(NotificationService::class);
        [$a, $b] = [$this->account('customer'), $this->account('customer')];
        $am = $this->account('account_manager');
        $mine = $service->send(['userId' => $a->id], 'k', 'For A', null);
        $theirs = $service->send(['userId' => $b->id], 'k', 'For B', null);
        $service->send(['role' => 'account_manager'], 'k', 'For AMs', null, 'installments', (string) Str::uuid());

        $this->as($a)->getJson('/api/v1/notifications')->assertOk()->assertJsonCount(1, 'notifications')->assertJsonPath('role', 'customer');
        $this->as($a)->getJson('/api/v1/notifications/count')->assertJson(['count' => 1]);
        $this->as($a)->postJson("/api/v1/notifications/{$theirs->id}/read")->assertNotFound();
        $this->as($a)->postJson("/api/v1/notifications/{$mine->id}/read")->assertOk();
        $this->assertFalse((bool) $theirs->fresh()->is_read);

        $this->as($am)->getJson('/api/v1/notifications')->assertJsonCount(1, 'notifications')->assertJsonPath('notifications.0.title', 'For AMs');
        $this->as($am)->postJson('/api/v1/notifications/read-all')->assertJson(['marked' => 1]);
        $this->assertSame(1, Notification::query()->where('is_read', false)->count()); // B's row untouched
    }

    #[Test]
    public function a_notification_needs_exactly_one_recipient(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        app(NotificationService::class)->send(['role' => 'ceo', 'userId' => (string) Str::uuid()], 'k', 't', null);
    }
}
