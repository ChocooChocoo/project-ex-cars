<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use App\Notifications\ConfirmEmailChange;
use App\Notifications\VerifyEmailOnFrontend;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Auth\Concerns\MakesAccounts;
use Tests\TestCase;

class SessionTest extends TestCase
{
    use MakesAccounts, RefreshDatabase;

    private function login(User $user, string $password = self::PASSWORD, bool $remember = false)
    {
        return $this->fromFrontend()->postJson('/api/v1/auth/login', ['email' => strtoupper($user->email), 'password' => $password, 'remember' => $remember]);
    }

    #[Test]
    public function login_returns_me_rotates_the_session_and_logout_ends_it(): void
    {
        $user = $this->account('sales_manager');
        $this->fromFrontend()->get('/sanctum/csrf-cookie')->assertNoContent();
        $before = session()->getId();

        $this->login($user)->assertOk()->assertExactJson([
            'id' => $user->id, 'email' => $user->email, 'email_verified' => true, 'role' => 'sales_manager',
            'profile' => ['full_name' => 'Sales_manager Tester', 'phone' => null, 'address' => null, 'address_line' => null, 'region_code' => null,
                'province_code' => null, 'city_code' => null, 'barangay_code' => null, 'avatar_url' => null, 'account_state' => 'active', 'tutorial_completed_at' => null],
        ]);
        $this->assertNotSame($before, session()->getId(), 'session id must change at login');
        $this->nextRequest()->getJson('/api/v1/me')->assertOk()->assertJsonPath('role', 'sales_manager');

        $this->nextRequest()->postJson('/api/v1/auth/logout')->assertNoContent();
        $this->nextRequest()->getJson('/api/v1/me')->assertUnauthorized()->assertJsonPath('code', 'not_authenticated');
    }

    #[Test]
    public function wrong_password_unverified_and_inactive_accounts_cannot_sign_in(): void
    {
        $this->login($this->account('customer'), 'Wrong#1234')->assertStatus(422)->assertJson(['code' => 'invalid_credentials', 'message' => 'Invalid login credentials']);
        $this->login($this->account('customer', verified: false))->assertForbidden()->assertJsonPath('code', 'email_not_verified');
        foreach (['suspended', 'archived', 'invited'] as $state) {
            $this->login($this->account('customer', state: $state))->assertForbidden()->assertJsonPath('code', 'account_inactive');
        }
        $this->assertGuest('web');
    }

    #[Test]
    public function an_account_suspended_mid_session_loses_access_on_its_next_request(): void
    {
        $user = $this->account('mechanic');
        $this->login($user)->assertOk();
        DB::table('profiles')->where('id', $user->id)->update(['account_state' => 'suspended']);

        $this->nextRequest()->getJson('/api/v1/me')->assertForbidden()->assertJsonPath('code', 'account_inactive');
        $this->nextRequest()->getJson('/api/v1/me')->assertUnauthorized();
    }

    #[Test]
    public function a_removed_role_also_revokes_access(): void
    {
        $user = $this->account('head_accountant');
        $this->login($user)->assertOk();
        DB::table('user_roles')->where('account_id', $user->id)->update(['active' => false]);
        $this->nextRequest()->getJson('/api/v1/me')->assertForbidden();
    }

    #[Test]
    public function stateful_writes_without_a_csrf_token_are_rejected(): void
    {
        $user = $this->account('customer');
        // CSRF checks are skipped while running unit tests; switch that off for this request.
        $this->app->detectEnvironment(fn () => 'local');

        $this->fromFrontend()->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => self::PASSWORD])
            ->assertStatus(419)->assertJsonPath('code', 'csrf_mismatch');
    }

    #[Test]
    public function remember_me_sets_a_long_lived_cookie_and_idle_sessions_expire(): void
    {
        $this->login($this->account('customer'), remember: true)->assertOk()->assertCookie(auth()->guard('web')->getRecallerName());
        $this->assertSame(120, (int) config('session.lifetime'));
        $this->assertFalse((bool) config('session.expire_on_close'));
    }

    #[Test]
    public function repeated_failed_logins_are_rate_limited(): void
    {
        $user = $this->account('customer');
        for ($i = 0; $i < 5; $i++) {
            $this->login($user, 'Wrong#1234')->assertStatus(422);
        }
        $this->login($user)->assertStatus(429)->assertJsonPath('code', 'rate_limited');
    }

    #[Test]
    public function registration_creates_user_profile_and_customer_role_and_requires_verification(): void
    {
        Notification::fake();
        $payload = ['email' => 'New.Buyer@test.local', 'password' => 'Secret#123', 'full_name' => 'New Buyer', 'accept_terms' => 'true', 'accept_policy' => 'true'];

        $this->fromFrontend()->postJson('/api/v1/auth/register', $payload)->assertCreated()->assertJsonPath('notice', 'Check your email to verify your account.');
        $user = User::query()->where('email', 'new.buyer@test.local')->firstOrFail();
        $this->assertSame('customer', $user->role()->value);
        $this->assertSame('New Buyer', $user->profile->full_name);
        $this->assertNotNull($user->terms_accepted_at);
        $this->assertGuest('web');

        $this->fromFrontend()->postJson('/api/v1/auth/register', $payload)->assertStatus(422)->assertJsonPath('message', 'This email is already registered. Please log in instead.');
        $this->fromFrontend()->postJson('/api/v1/auth/register', ['accept_policy' => 'false'] + $payload)->assertStatus(422);

        // The emailed link is a signed relative API path wrapped in the frontend /auth/confirm URL.
        Notification::assertSentTo($user, VerifyEmailOnFrontend::class, function ($n) use ($user) {
            $link = $n->toMail($user)->actionUrl;
            $this->assertStringStartsWith('http://localhost:3000/auth/confirm?verify=', $link);
            parse_str(parse_url($link, PHP_URL_QUERY), $q);
            $this->nextRequest()->getJson($q['verify'])->assertOk()->assertJsonPath('email_verified', true);
            $this->nextRequest()->getJson($q['verify'].'x')->assertForbidden(); // tampered signature

            return true;
        });
        $this->assertAuthenticatedAs($user->fresh(), 'web');
    }

    #[Test]
    public function changing_password_needs_the_current_one_and_ends_other_sessions(): void
    {
        $user = $this->account('customer');
        DB::table('sessions')->insert(['id' => 'other-browser', 'user_id' => $user->id, 'payload' => '', 'last_activity' => time()]);
        $this->actingAs($user, 'web');

        $this->fromFrontend()->putJson('/api/v1/me/password', ['current_password' => 'Nope#1234', 'new_password' => 'Fresh#5678'])
            ->assertStatus(422)->assertJsonPath('message', 'Your current password is not correct.');
        $this->fromFrontend()->putJson('/api/v1/me/password', ['current_password' => self::PASSWORD, 'new_password' => 'Fresh#5678'])->assertOk();

        $this->assertDatabaseMissing('sessions', ['id' => 'other-browser']);
        $this->assertTrue(password_verify('Fresh#5678', $user->fresh()->password));
    }

    #[Test]
    public function password_reset_flow(): void
    {
        Notification::fake();
        $user = $this->account('customer');
        $this->fromFrontend()->postJson('/api/v1/auth/password/forgot', ['email' => $user->email])->assertStatus(202);
        $this->fromFrontend()->postJson('/api/v1/auth/password/forgot', ['email' => 'nobody@test.local'])->assertStatus(202);

        Notification::assertSentTo($user, ResetPassword::class, function (ResetPassword $n) use ($user) {
            $this->assertStringStartsWith('http://localhost:3000/auth/v1/reset-password?token=', $n->toMail($user)->actionUrl);
            $this->fromFrontend()->postJson('/api/v1/auth/password/reset', ['token' => $n->token, 'email' => $user->email, 'password' => 'Brand#New1'])->assertOk();

            return true;
        });
        $this->login($user, 'Brand#New1')->assertOk();
    }

    #[Test]
    public function customer_email_change_is_confirmed_from_the_new_address(): void
    {
        Notification::fake();
        $user = $this->account('customer');
        $this->actingAs($user, 'web');

        $this->fromFrontend()->postJson('/api/v1/me/email', ['email' => $user->email])->assertStatus(422)->assertJsonPath('message', 'This is already your email.');
        $this->fromFrontend()->postJson('/api/v1/me/email', ['email' => ' Moved@Test.local '])->assertOk()->assertJsonPath('email', 'moved@test.local');
        $this->assertSame($user->email, $user->fresh()->email, 'unchanged until confirmed');

        Notification::assertSentOnDemand(ConfirmEmailChange::class, function (ConfirmEmailChange $n, array $channels, object $notifiable) use ($user) {
            parse_str(parse_url($n->toMail($notifiable)->actionUrl, PHP_URL_QUERY), $q);
            $this->assertSame('/customer/profile', $q['next']);
            $this->nextRequest()->getJson($q['verify'])->assertOk()->assertJsonPath('email', 'moved@test.local');

            return true;
        });
        $this->assertSame('moved@test.local', $user->fresh()->email);
    }

    #[Test]
    public function own_profile_update_writes_only_the_session_users_row(): void
    {
        $user = $this->account('customer');
        $other = $this->account('customer');
        $this->actingAs($user, 'web');

        $this->fromFrontend()->patchJson('/api/v1/me/profile', [
            'id' => $other->id, // forged; ignored
            'full_name' => '  Juan Dela Cruz ', 'phone' => '09171234567', 'address' => 'Brgy 1, Dasmariñas, Cavite',
            'region_code' => '040000000', 'city_code' => '042106000', 'barangay_code' => '042106001',
        ])->assertOk()->assertJsonPath('profile.full_name', 'Juan Dela Cruz')->assertJsonPath('profile.address', 'Brgy 1, Dasmariñas, Cavite');

        $this->assertSame('Customer Tester', $other->profile()->value('full_name'));
        $this->fromFrontend()->patchJson('/api/v1/me/profile', ['full_name' => 'X', 'region_code' => 'nope', 'city_code' => '1', 'barangay_code' => '1'])
            ->assertStatus(422)->assertJsonPath('message', 'Choose your region.');
    }
}
