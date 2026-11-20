<?php

namespace Tests\Feature\Trading\Concerns;

use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Feature\Auth\Concerns\MakesAccounts;

/** Rows the trading tests start from, written straight to MySQL like the t01 e2e fixtures did through Supabase. */
trait TradingFixtures
{
    use MakesAccounts;

    protected ?User $actor = null;

    /** Acts as $user for the next request (JSON errors, like the browser adapter). */
    protected function act(User $user): static
    {
        $this->actor = $user;

        return $this->as($user)->withHeaders(['Accept' => 'application/json']);
    }

    /** Another request from the same user (nextRequest() would drop the acting user). */
    protected function again(): static
    {
        return $this->act($this->actor);
    }


    protected function customer(string $region = '040000000'): User
    {
        $user = $this->account('customer');
        DB::table('profiles')->where('id', $user->id)->update([
            'address' => 'Lot 1, Barangay Uno, Calamba, Laguna', 'region_code' => $region, 'province_code' => '043400000', 'city_code' => '043405000', 'barangay_code' => '043405001',
        ]);

        return $user;
    }

    protected function vehicle(float $price = 500000, string $state = 'available'): string
    {
        $id = (string) Str::uuid();
        DB::table('vehicles')->insert(['id' => $id, 'stock_code' => 'T-'.substr($id, 0, 8), 'make' => 'Toyota', 'model' => 'Vios', 'year' => 2021,
            'condition' => 'Good', 'current_price' => $price, 'listing_state' => $state, 'created_at' => now(), 'updated_at' => now()]);

        return $id;
    }

    /** A future business slot (on the hour, 9 AM–9 PM Manila, Monday–Saturday) $days ahead at $hour Manila time. */
    protected function slot(int $days = 2, int $hour = 10): CarbonImmutable
    {
        $at = CarbonImmutable::now('Asia/Manila')->addDays($days)->setTime($hour, 0);
        while ($at->dayOfWeek === 0) {
            $at = $at->addDay();
        }

        return $at->utc();
    }

    /** The four ID images, proof of billing, and payslip, as rows ($state = pending|verified). */
    protected function buyerDocuments(string $transactionId, string $uploader, string $state = 'pending'): void
    {
        foreach ([
            ['valid_id', 'passport', 'front'], ['valid_id', 'passport', 'back'],
            ['valid_id', 'umid', 'front'], ['valid_id', 'umid', 'back'],
            ['proof_of_billing', null, null], ['payslip', null, null],
        ] as [$kind, $type, $side]) {
            DB::table('transaction_documents')->insert([
                'id' => (string) Str::uuid(), 'transaction_id' => $transactionId, 'document_kind' => $kind,
                'id_type' => $type, 'id_side' => $side, 'storage_path' => "{$transactionId}/x-".Str::random(6).'.jpg', 'uploader_id' => $uploader,
                'verification_state' => $state, 'upload_date' => now(),
            ]);
        }
    }

    /** A draft buy request with its details saved; a booked arrangement when $slot is given. */
    protected function buyRequest(User $customer, string $vehicleId, string $method = 'cash', string $arrangement = 'gce_visit', ?CarbonImmutable $slot = null, array $tx = []): string
    {
        $id = (string) Str::uuid();
        DB::table('transactions')->insert($tx + ['id' => $id, 'customer_id' => $customer->id, 'created_by' => $customer->id, 'transaction_kind' => 'buy',
            'vehicle_id' => $vehicleId, 'current_state' => 'pending', 'opened_at' => now()->subDays(10), 'created_at' => now(), 'updated_at' => now()]);
        DB::table('purchase_details')->insert(['id' => (string) Str::uuid(), 'transaction_id' => $id, 'payment_method' => $method,
            'payment_option' => $method === 'financing' ? 'financing' : 'full', 'arrangement_kind' => $arrangement,
            'final_price' => DB::table('vehicles')->where('id', $vehicleId)->value('current_price'),
            'location' => $arrangement === 'gce_visit' ? null : 'Lot 1, Barangay Uno, Calamba, Laguna',
            'condition_acknowledged_at' => now(), 'delivery_terms_agreed_at' => $arrangement === 'delivery' ? now() : null,
            'requested_term_months' => $method === 'financing' ? 12 : null, 'created_at' => now(), 'updated_at' => now()]);
        if ($slot) {
            DB::table('viewing_arrangements')->insert(['id' => (string) Str::uuid(), 'purchase_transaction_id' => $id, 'vehicle_id' => $vehicleId,
                'arrangement_kind' => $arrangement, 'schedule' => $slot, 'location' => $arrangement === 'gce_visit' ? null : 'Lot 1, Barangay Uno, Calamba, Laguna', 'created_at' => now()]);
        }

        return $id;
    }

    protected function historyCount(string $transactionId): int
    {
        return DB::table('transaction_status_history')->where('transaction_id', $transactionId)->count();
    }

    protected function payment(string $transactionId, string $kind, float $amount, ?string $verifier): void
    {
        DB::table('payment_records')->insert(['id' => (string) Str::uuid(), 'transaction_id' => $transactionId, 'amount' => $amount, 'method' => 'cash',
            'payment_kind' => $kind, 'recorded_by' => $verifier ?? DB::table('users')->value('id'), 'verified_by' => $verifier, 'settlement_date' => now()->toDateString(), 'created_at' => now()]);
    }
}
