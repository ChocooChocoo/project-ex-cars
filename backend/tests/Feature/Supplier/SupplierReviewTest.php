<?php

namespace Tests\Feature\Supplier;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Auth\Concerns\MakesAccounts;
use Tests\TestCase;

/** Process & Revision Notes Phase 2: the MS reviews a supplier post, chats with the supplier and asks the CEO. */
class SupplierReviewTest extends TestCase
{
    use MakesAccounts, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        Notification::fake();
    }

    private function supplier(): User
    {
        $email = uniqid('supplier').'@gmail.com';
        $this->as($this->account('account_manager'))->postJson('/api/v1/admin/accounts/supplier', [
            'full_name' => 'Juan Dela Cruz', 'email' => $email, 'company_name' => 'Cavite Auto Supply',
        ])->assertCreated();

        return User::query()->where('email', $email)->firstOrFail();
    }

    private function vehiclePost(User $supplier): string
    {
        return $this->as($supplier)->post('/api/v1/supplier/posts', [
            'make' => 'Toyota', 'model' => 'Vios', 'year' => 2019, 'mileage' => 45000, 'asking_price' => 480000,
            'photos' => [UploadedFile::fake()->image('front.jpg')],
        ])->assertCreated()->json('id');
    }

    #[Test]
    public function the_ms_proposes_with_a_market_value_and_the_ceo_decides_once(): void
    {
        $supplier = $this->supplier();
        $id = $this->vehiclePost($supplier);
        $ms = $this->account('marketing_specialist');
        $ceo = $this->account('ceo');

        $this->as($ms)->postJson("/api/v1/staff/supplier-posts/{$id}/propose", ['reason' => 'Good stock'])->assertStatus(422);
        $this->as($this->account('confidential_informant'))->postJson("/api/v1/staff/supplier-posts/{$id}/propose", ['market_value' => 450000, 'reason' => 'x'])->assertForbidden();
        $this->as($ms)->postJson("/api/v1/staff/supplier-posts/{$id}/propose", ['market_value' => 450000, 'reason' => 'Sells fast'])->assertOk();
        $this->as($ms)->postJson("/api/v1/staff/supplier-posts/{$id}/decide", ['decision' => 'approved'])->assertForbidden();
        $this->assertSame(1, DB::table('notifications')->where('kind', 'supplier_proposal')->where('recipient_role', 'ceo')->count());

        $this->as($ceo)->postJson("/api/v1/staff/supplier-posts/{$id}/decide", ['decision' => 'rejected', 'reason' => 'Too old'])->assertOk();
        $post = DB::table('supplier_vehicle_posts')->where('id', $id)->first();
        $this->assertSame(['rejected', 'Too old', '450000.00'], [$post->state, $post->decision_reason, $post->market_value]);
        $this->assertSame(1, DB::table('notifications')->where('kind', 'supplier_rejected')->where('recipient_id', $supplier->id)->count());

        // A rejected post ends: it cannot be proposed or decided again.
        $this->as($ms)->postJson("/api/v1/staff/supplier-posts/{$id}/propose", ['market_value' => 450000, 'reason' => 'Again'])->assertStatus(409);
        $this->as($ceo)->postJson("/api/v1/staff/supplier-posts/{$id}/decide", ['decision' => 'approved'])->assertStatus(409);
        $this->as($supplier)->getJson('/api/v1/supplier/dashboard')->assertOk()->assertJsonPath('posts.0.decision_reason', 'Too old');
    }

    #[Test]
    public function the_post_chat_belongs_to_its_supplier_and_the_ms_and_the_ceo_and_ci_only_read_it(): void
    {
        $supplier = $this->supplier();
        $other = $this->supplier();
        $id = $this->vehiclePost($supplier);
        $thread = DB::table('inquiries')->where('supplier_post_id', $id)->value('id');
        $this->assertNotNull($thread);
        $this->as($supplier)->getJson('/api/v1/supplier/dashboard')->assertJsonPath('posts.0.thread_id', $thread);

        $this->as($supplier)->postJson("/api/v1/inquiries/{$thread}/messages", ['message_text' => 'Still available'])->assertCreated();
        $ms = $this->account('marketing_specialist');
        $this->as($ms)->postJson("/api/v1/inquiries/{$thread}/messages", ['message_text' => 'Can we inspect Friday?'])->assertCreated();
        $this->as($ms)->getJson("/api/v1/inquiries/{$thread}")->assertOk()->assertJsonPath('inquiry.vehicles.model', 'Vios')->assertJsonCount(2, 'messages');

        foreach (['ceo', 'confidential_informant'] as $role) {
            $reader = $this->account($role);
            $this->as($reader)->getJson("/api/v1/inquiries/{$thread}")->assertOk();
            $this->as($reader)->postJson("/api/v1/inquiries/{$thread}/messages", ['message_text' => 'Hi'])->assertForbidden();
        }
        $this->as($other)->getJson("/api/v1/inquiries/{$thread}")->assertNotFound();
        $this->as($this->account('account_manager'))->getJson("/api/v1/inquiries/{$thread}")->assertNotFound();
        $this->as($this->account('sales_manager'))->getJson("/api/v1/inquiries/{$thread}")->assertNotFound();
        // The CEO's inbox stays the buying inbox.
        $this->as($this->account('ceo'))->getJson('/api/v1/inquiries')->assertOk()->assertJsonCount(0, 'inquiries');
    }
}
