<?php

namespace Tests\Feature\Supplier;

use App\Models\User;
use App\Notifications\SupplierAccountCreated;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Auth\Concerns\MakesAccounts;
use Tests\TestCase;

/** Process & Revision Notes Phase 1: supplier accounts, approval and the private supplier portal. */
class SupplierAccountsTest extends TestCase
{
    use MakesAccounts, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
    }

    /** An approved supplier, created the way the Account Manager does. */
    private function supplier(string $company = 'Cavite Auto Supply'): User
    {
        $email = uniqid('supplier').'@gmail.com';
        $this->as($this->account('account_manager'))->postJson('/api/v1/admin/accounts/supplier', [
            'full_name' => 'Juan Dela Cruz', 'email' => $email, 'company_name' => $company,
        ])->assertCreated();

        return User::query()->where('email', $email)->firstOrFail();
    }

    private function vehiclePost(User $supplier, array $override = []): string
    {
        return $this->as($supplier)->post('/api/v1/supplier/posts', $override + [
            'make' => 'Toyota', 'model' => 'Vios', 'year' => 2019, 'mileage' => 45000, 'asking_price' => 480000,
            'photos' => [UploadedFile::fake()->image('front.jpg')],
        ])->assertCreated()->json('id');
    }

    #[Test]
    public function the_account_manager_creates_a_supplier_and_the_mail_has_no_password(): void
    {
        Notification::fake();
        $supplier = $this->supplier();

        $this->assertTrue($supplier->hasRole('supplier'));
        $this->assertSame('approved', DB::table('supplier_profiles')->where('user_id', $supplier->id)->value('approval_state'));
        Notification::assertSentTo($supplier, SupplierAccountCreated::class, function (SupplierAccountCreated $mail) use ($supplier) {
            $text = implode(' ', array_map('strval', array_merge($mail->toMail($supplier)->introLines, [$mail->toMail($supplier)->actionUrl])));
            $this->assertStringContainsString('reset-password?token=', $text);
            $this->assertStringNotContainsString(self::PASSWORD, $text);

            return $mail->toMail($supplier)->subject === 'You now have an account on the GCE website';
        });
        // A customer or a Sales Manager cannot create one.
        $this->as($this->account('sales_manager'))->postJson('/api/v1/admin/accounts/supplier', [
            'full_name' => 'X Y', 'email' => 'x@gmail.com', 'company_name' => 'X',
        ])->assertForbidden();
    }

    #[Test]
    public function a_self_registered_supplier_waits_for_approval_before_using_the_portal(): void
    {
        Notification::fake();
        $this->fromFrontend()->postJson('/api/v1/auth/register-supplier', [
            'email' => 'new.supplier@gmail.com', 'password' => 'Secret#12345', 'full_name' => 'Ana Santos',
            'company_name' => 'Santos Motors', 'accept_terms' => true,
        ])->assertCreated();
        $supplier = User::query()->where('email', 'new.supplier@gmail.com')->firstOrFail();
        $supplier->forceFill(['email_verified_at' => now()])->save();

        $this->as($supplier)->getJson('/api/v1/supplier/dashboard')->assertForbidden()
            ->assertJson(['message' => "Your supplier account is waiting for GCE's approval."]);
        $am = $this->account('account_manager');
        $this->as($am)->getJson('/api/v1/admin/suppliers')->assertOk()->assertJsonPath('suppliers.0.approval_state', 'pending');
        $this->as($am)->postJson('/api/v1/admin/suppliers/decide', ['user_id' => $supplier->id, 'decision' => 'approved'])->assertOk();
        $this->as($am)->postJson('/api/v1/admin/suppliers/decide', ['user_id' => $supplier->id, 'decision' => 'rejected'])->assertStatus(409);

        $this->as($supplier)->getJson('/api/v1/supplier/dashboard')->assertOk()->assertJsonPath('company_name', 'Santos Motors');
    }

    #[Test]
    public function a_supplier_reads_only_their_own_posts_and_only_three_staff_roles_see_them(): void
    {
        $a = $this->supplier('A Motors');
        $b = $this->supplier('B Motors');
        $postA = $this->vehiclePost($a);
        $this->vehiclePost($b, ['make' => 'Honda', 'model' => 'City']);
        DB::table('supplier_vehicle_posts')->insert(['id' => (string) Str::uuid(), 'supplier_id' => $a->id, 'make' => 'Ford', 'model' => 'Ranger',
            'year' => 2018, 'mileage' => 1, 'asking_price' => 1, 'photos' => '[]', 'state' => 'purchased', 'created_at' => now(), 'updated_at' => now()]);

        $dash = $this->as($a)->getJson('/api/v1/supplier/dashboard')->assertOk();
        $dash->assertJsonPath('counts.posted', 1)->assertJsonPath('counts.purchased', 1)->assertJsonPath('counts.transactions', 0)->assertJsonCount(2, 'posts');
        $this->assertNotContains('Honda', array_column($dash->json('posts'), 'make'));
        // B cannot edit or withdraw A's post, and photo links are signed, not public paths.
        $this->as($b)->postJson("/api/v1/supplier/posts/{$postA}/withdraw")->assertStatus(409);
        $this->assertStringContainsString('signature=', $dash->json('posts.1.photos.0') ?? $dash->json('posts.0.photos.0'));
        // Suppliers never reach the staff list.
        $this->as($a)->getJson('/api/v1/staff/supplier-posts')->assertForbidden();

        foreach (['confidential_informant', 'marketing_specialist', 'ceo'] as $role) {
            $this->as($this->account($role))->getJson('/api/v1/staff/supplier-posts')->assertOk()->assertJsonPath('posts.0.company_name', fn ($c) => in_array($c, ['A Motors', 'B Motors'], true));
            $this->as($this->account($role))->getJson("/api/v1/staff/supplier-posts/{$postA}")->assertOk()->assertJsonPath('post.company_name', 'A Motors');
        }
        foreach (['sales_manager', 'head_accountant', 'mechanic', 'customer'] as $role) {
            $this->as($this->account($role))->getJson('/api/v1/staff/supplier-posts')->assertForbidden();
        }
    }

    #[Test]
    public function a_post_needs_a_photo_and_can_be_edited_only_while_posted(): void
    {
        $supplier = $this->supplier();
        $this->as($supplier)->post('/api/v1/supplier/posts', ['make' => 'Toyota', 'model' => 'Vios', 'year' => 2019, 'mileage' => 1, 'asking_price' => 1])
            ->assertStatus(422);
        $id = $this->vehiclePost($supplier);
        $this->as($supplier)->postJson("/api/v1/supplier/posts/{$id}", ['make' => 'Toyota', 'model' => 'Vios G', 'year' => 2019, 'mileage' => 1, 'asking_price' => 470000])->assertOk();
        DB::table('supplier_vehicle_posts')->where('id', $id)->update(['state' => 'proposed']);
        $this->as($supplier)->postJson("/api/v1/supplier/posts/{$id}", ['make' => 'Toyota', 'model' => 'Vios', 'year' => 2019, 'mileage' => 1, 'asking_price' => 1])->assertStatus(409);
        $this->as($supplier)->postJson("/api/v1/supplier/posts/{$id}/withdraw")->assertOk();
        $this->assertSame('withdrawn', DB::table('supplier_vehicle_posts')->where('id', $id)->value('state'));
    }
}
