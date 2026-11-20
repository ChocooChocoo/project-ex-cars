<?php

namespace Tests\Feature\Trading;

use App\Services\Trading\BuyRules;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Trading\Concerns\TradingFixtures;
use Tests\TestCase;

/**
 * Plan Phase 3 (BH-1 and SH-12): a halfway meet-up is booked at least 2 Manila calendar days ahead, a GCE
 * visit may still be booked later the same day, and no schedule the field team is sent to may be in the past.
 * Every comparison is in Asia/Manila, whatever time zone the app timezone (UTC) is.
 *
 * The clock is frozen at 19:50 on Wednesday 20 November 2026 in Manila, so the "day after tomorrow" boundary
 * (Friday the 20th) is a business day and the rejected day (Thursday the 19th) is one too.
 */
class ScheduleRulesTest extends TestCase
{
    use RefreshDatabase, TradingFixtures;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
    }

    /** Friday 18 November 2026 is a Wednesday; freeze the clock at 19:50 Manila that evening. */
    private function freezeOnWednesdayEvening(): void
    {
        $this->travelTo(CarbonImmutable::parse('2026-11-18 19:50:00', 'Asia/Manila'));
    }

    /** A Manila wall clock as the browser posts it, e.g. "2026-11-20T10:00:00+08:00". */
    private function manilaSlot(string $day, int $hour): string
    {
        return CarbonImmutable::parse("{$day} {$hour}:00:00", 'Asia/Manila')->toIso8601String();
    }

    /** A stored schedule back on its Manila wall clock, so the assertion never depends on the app timezone. */
    private function manilaStored(mixed $at): string
    {
        return CarbonImmutable::parse((string) $at, 'UTC')->setTimezone('Asia/Manila')->format('Y-m-d H:i');
    }

    #[Test]
    public function is_meetup_date_counts_manila_calendar_days_only(): void
    {
        $now = CarbonImmutable::parse('2026-11-18 19:50:00', 'Asia/Manila');

        // The day after tomorrow at any hour already qualifies, even before tonight's hour has passed.
        $this->assertTrue(BuyRules::isMeetupDate(CarbonImmutable::parse('2026-11-20 09:00:00', 'Asia/Manila'), $now));
        $this->assertTrue(BuyRules::isMeetupDate(CarbonImmutable::parse('2026-11-20 21:00:00', 'Asia/Manila'), $now));
        // Tomorrow, later today and last week do not.
        $this->assertFalse(BuyRules::isMeetupDate(CarbonImmutable::parse('2026-11-19 21:00:00', 'Asia/Manila'), $now));
        $this->assertFalse(BuyRules::isMeetupDate(CarbonImmutable::parse('2026-11-18 21:00:00', 'Asia/Manila'), $now));
        $this->assertFalse(BuyRules::isMeetupDate(CarbonImmutable::parse('2026-11-17 10:00:00', 'Asia/Manila'), $now));
        // Manila midnight is 16:00Z the day before: the calendar date is read in Manila, never in UTC.
        $this->assertTrue(BuyRules::isMeetupDate(CarbonImmutable::parse('2026-11-19T16:00:00Z'), $now));
        $this->assertFalse(BuyRules::isMeetupDate(CarbonImmutable::parse('2026-11-19T15:00:00Z'), $now));
    }

    #[Test]
    public function a_halfway_meetup_needs_two_manila_days_but_a_gce_visit_is_the_same_day(): void
    {
        $this->freezeOnWednesdayEvening();
        $buyer = $this->customer();
        $id = $this->buyRequest($buyer, $this->vehicle(), 'cash', 'meetup');
        $meetup = [
            'transaction_id' => $id, 'payment_method' => 'cash', 'arrangement_kind' => 'meetup',
            'acknowledge_condition' => 'yes', 'meetup_lat' => 14.33, 'meetup_lng' => 120.94,
            'meetup_address' => 'Block 4 Lot 5, Bagong Bayan, Dasmariñas, Cavite, Calabarzon',
        ];

        // Tomorrow at 10 AM is inside 48 hours but short of 2 Manila calendar days.
        $this->act($buyer)->postJson('/api/v1/trading/buy-details', $meetup + ['schedule' => $this->manilaSlot('2026-11-19', 10)])
            ->assertStatus(422)->assertJson(['message' => BuyRules::MEETUP_LEAD_MESSAGE]);
        $this->assertSame(0, DB::table('viewing_arrangements')->where('purchase_transaction_id', $id)->count());

        // The day after tomorrow at 9 AM is the boundary and is accepted.
        $this->again()->postJson('/api/v1/trading/buy-details', $meetup + ['schedule' => $this->manilaSlot('2026-11-20', 9)])
            ->assertOk();
        $this->assertSame('2026-11-20 09:00', $this->manilaStored(DB::table('viewing_arrangements')
            ->where('purchase_transaction_id', $id)->value('schedule')));

        // A GCE visit the same evening is still bookable.
        $visit = $this->buyRequest($buyer, $this->vehicle(), 'cash', 'gce_visit');
        $this->act($buyer)->postJson('/api/v1/trading/buy-details', [
            'transaction_id' => $visit, 'payment_method' => 'cash', 'arrangement_kind' => 'gce_visit',
            'schedule' => $this->manilaSlot('2026-11-18', 21),
        ])->assertOk();
    }

    #[Test]
    public function submit_rechecks_the_meetup_lead_time(): void
    {
        $this->freezeOnWednesdayEvening();
        $buyer = $this->customer();
        // A slot booked before the rule landed, one day ahead.
        $booked = CarbonImmutable::parse('2026-11-19 21:00:00', 'Asia/Manila')->utc();
        $id = $this->buyRequest($buyer, $this->vehicle(), 'cash', 'meetup', $booked);
        $this->buyerDocuments($id, $buyer->id, 'verified');

        $this->act($buyer)->postJson('/api/v1/trading/submit-buy-request', ['transaction_id' => $id])
            ->assertStatus(422)->assertJson(['message' => BuyRules::MEETUP_LEAD_MESSAGE]);
        $this->assertSame('pending', DB::table('transactions')->where('id', $id)->value('current_state'));
    }

    #[Test]
    public function a_financing_meetup_rebooks_inside_the_two_day_rule(): void
    {
        $this->freezeOnWednesdayEvening();
        $buyer = $this->customer();
        $id = $this->buyRequest($buyer, $this->vehicle(), 'financing', 'meetup', null, ['flow_status' => 'approved_awaiting_buyer_decision']);
        $offer = [
            'transaction_id' => $id, 'decision' => 'proceed',
            'meetup_lat' => 14.33, 'meetup_lng' => 120.94, 'meetup_address' => 'SM Calamba, Laguna',
        ];

        $this->act($buyer)->postJson('/api/v1/trading/financing-offer', $offer + ['schedule' => $this->manilaSlot('2026-11-19', 10)])
            ->assertStatus(422)->assertJson(['message' => BuyRules::MEETUP_LEAD_MESSAGE]);
        $this->assertSame(0, DB::table('viewing_arrangements')->where('purchase_transaction_id', $id)->count());

        $this->again()->postJson('/api/v1/trading/financing-offer', $offer + ['schedule' => $this->manilaSlot('2026-11-20', 10)])
            ->assertOk();
        $this->assertSame('meetup', DB::table('viewing_arrangements')->where('purchase_transaction_id', $id)->value('arrangement_kind'));
    }

    #[Test]
    public function a_meetup_already_booked_earlier_is_still_readable_and_editable(): void
    {
        $this->freezeOnWednesdayEvening();
        $buyer = $this->customer();
        // Booked before the rule: tomorrow. It must stay readable and its details must stay editable.
        $old = CarbonImmutable::parse('2026-11-19 10:00:00', 'Asia/Manila')->utc();
        $id = $this->buyRequest($buyer, $this->vehicle(), 'cash', 'meetup', $old);

        $this->act($buyer)->getJson("/api/v1/my-transactions/{$id}")->assertOk();
        $this->act($buyer)->postJson('/api/v1/trading/buy-details', [
            'transaction_id' => $id, 'payment_method' => 'cash', 'arrangement_kind' => 'meetup',
            'acknowledge_condition' => 'yes', 'meetup_lat' => 14.33, 'meetup_lng' => 120.94,
            'meetup_address' => 'Block 4 Lot 5, Bagong Bayan, Dasmariñas, Cavite, Calabarzon',
        ])->assertOk();
        // The old booking is untouched: rejecting a new slot never cancels the one the buyer already has.
        $this->assertSame(1, DB::table('viewing_arrangements')->where('purchase_transaction_id', $id)
            ->whereIn('confirmation_state', ['pending', 'confirmed'])->count());
    }

    #[Test]
    public function the_marketing_specialist_cannot_record_a_past_schedule(): void
    {
        $this->freezeOnWednesdayEvening();
        $ms = $this->account('marketing_specialist');
        $mechanic = $this->account('mechanic');
        $informant = $this->account('confidential_informant');
        $id = $this->approvedSellOffer('meet_halfway');
        $agreed = ['transaction_id' => $id, 'agreed_price' => 450000, 'informant_id' => $informant->id, 'mechanic_id' => $mechanic->id];

        // Yesterday: refused because it passed.
        $this->act($ms)->postJson('/api/v1/staff/trading/sell/record-agreed-price', $agreed + [
            'schedule' => $this->manilaSlot('2026-11-17', 10),
        ])->assertStatus(422)->assertJson(['message' => 'Set a future meet-up date and time.']);
        // Tomorrow: in the future, but a Meet Halfway trip keeps the 2-day lead time.
        $this->again()->postJson('/api/v1/staff/trading/sell/record-agreed-price', $agreed + [
            'schedule' => $this->manilaSlot('2026-11-19', 10),
        ])->assertStatus(422)->assertJson(['message' => BuyRules::MEETUP_LEAD_MESSAGE]);
        $this->assertSame(0, DB::table('field_cases')->where('transaction_id', $id)->count());

        // The day after tomorrow is the boundary and is accepted.
        $this->again()->postJson('/api/v1/staff/trading/sell/record-agreed-price', $agreed + [
            'schedule' => $this->manilaSlot('2026-11-20', 9),
        ])->assertOk();
        $this->assertSame('2026-11-20 09:00', $this->manilaStored(DB::table('field_cases')->where('transaction_id', $id)->value('schedule')));
    }

    #[Test]
    public function a_gce_visit_field_case_may_be_scheduled_later_tonight(): void
    {
        $this->freezeOnWednesdayEvening();
        $ms = $this->account('marketing_specialist');
        $mechanic = $this->account('mechanic');
        $id = $this->approvedSellOffer('gce_visit');

        $this->act($ms)->postJson('/api/v1/staff/trading/sell/record-agreed-price', [
            'transaction_id' => $id, 'agreed_price' => 450000, 'mechanic_id' => $mechanic->id,
            'schedule' => $this->manilaSlot('2026-11-18', 21),
        ])->assertOk();
        $this->assertSame('GCE', DB::table('field_cases')->where('transaction_id', $id)->value('location'));
    }

    /** An approved sell offer whose ceiling the CEO already approved. */
    private function approvedSellOffer(string $method): string
    {
        $customer = $this->customer();
        $id = (string) Str::uuid();
        DB::table('transactions')->insert(['id' => $id, 'customer_id' => $customer->id, 'created_by' => $customer->id, 'transaction_kind' => 'sell',
            'vehicle_id' => $this->vehicle(), 'current_state' => 'approved', 'opened_at' => now(), 'created_at' => now(), 'updated_at' => now()]);
        DB::table('sell_details')->insert(['id' => (string) Str::uuid(), 'transaction_id' => $id, 'offered_amount' => 500000,
            'meetup_method' => $method, 'meetup_lat' => 14.33, 'meetup_lng' => 120.94,
            'meetup_address' => 'Block 4 Lot 5, Bagong Bayan, Dasmariñas, Cavite, Calabarzon', 'created_at' => now(), 'updated_at' => now()]);
        DB::table('vehicle_price_proposals')->insert(['id' => (string) Str::uuid(), 'vehicle_id' => $this->vehicle(), 'transaction_id' => $id,
            'proposal_kind' => 'purchase_ceiling', 'proposed_amount' => 500000, 'proposer_id' => $customer->id, 'decision' => 'approved', 'created_at' => now()]);

        return $id;
    }
}
