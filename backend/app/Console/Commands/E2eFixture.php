<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Test data for the Playwright specs (was the Supabase service-role helpers in src/tests/e2e/support). Only moves
 * the clock or stands in for an external payment provider; never performs a flow step. Refused outside
 * local/testing/staging (staging holds demo data only; production is never allowed).
 */
class E2eFixture extends Command
{
    protected $signature = 'e2e:fixture {action} {arg?} {extra?}';

    protected $description = 'Test-only fixtures for the e2e specs (create-vehicle, archive-test-vehicles, record-delivery-payments, ...).';

    public function handle(): int
    {
        if (! app()->environment(['local', 'testing', 'staging'])) {
            $this->error('e2e:fixture only runs in local, testing or staging.');

            return self::FAILURE;
        }
        $arg = $this->argument('arg');
        $customer = fn () => DB::table('users')->where('email', 'customer@gce.local')->value('id');
        $tx = fn () => DB::table('transactions')->where('id', $arg)->first() ?? throw new \RuntimeException("Transaction {$arg} not found.");

        match ($this->argument('action')) {
            'create-vehicle' => $this->line($this->createVehicle((string) ($arg ?? 'E2E'), (float) ($this->argument('extra') ?? 500000))),
            'archive-test-vehicles' => DB::table('vehicles')->where('stock_code', 'like', 'E2E-T01-%')->where('listing_state', 'available')->update(['listing_state' => 'archived']),
            'customer-id' => $this->line((string) $customer()),
            'reset-standing' => DB::table('customer_standing')->where('account_id', $customer())->delete(),
            // T10: buying addresses start from the profile's PSGC address (the Supabase seed had one).
            'set-customer-address' => DB::table('profiles')->where('id', $customer())->update([
                'address' => 'Lot 1, Bagong Kalsada, City of Calamba, Laguna, CALABARZON', 'address_line' => 'Lot 1',
                'region_code' => '040000000', 'province_code' => '043400000', 'city_code' => '043405000', 'barangay_code' => '043405001',
            ]),
            'record-delivery-payments' => $this->recordPayments($tx(), ['delivery_fee', 'downpayment'], 'paymongo'),
            'record-financing-downpayment' => $this->recordFinancingDownpayment($tx()),
            'record-verified-payment' => $this->recordVerifiedPayment($tx(), (float) $this->argument('extra')),
            'mark-financing-paid' => $this->markFinancingPaid($tx()),
            'query' => $this->line(json_encode(['data' => $this->query(json_decode(base64_decode(strtr((string) $arg, '-_', '+/')), true, 32, JSON_THROW_ON_ERROR))])),
            default => throw new \InvalidArgumentException('Unknown fixture action.'),
        };

        return self::SUCCESS;
    }

    private function createVehicle(string $label, float $price): string
    {
        $id = (string) Str::uuid();
        DB::table('vehicles')->insert([
            'id' => $id, 'stock_code' => 'E2E-T01-'.$label.'-'.strtoupper(base_convert((string) now()->getTimestampMs(), 10, 36)),
            'make' => 'E2E', 'model' => "Test {$label}", 'year' => 2022, 'mileage' => 10000, 'condition' => 'Good', 'current_price' => $price,
            'listing_state' => 'available', 'posted_at' => now(), 'description' => 'Created by the T01 end-to-end tests. Not a real listing.',
            'created_at' => now(), 'updated_at' => now(),
        ]);

        return $id;
    }

    /** The verified rows a successful PayMongo checkout creates (Phase 6 owns the real ones). */
    private function recordPayments(object $tx, array $kinds, string $method): void
    {
        $details = DB::table('purchase_details')->where('transaction_id', $tx->id)->first();
        foreach ($kinds as $kind) {
            $amount = (float) ($kind === 'delivery_fee' ? $details?->delivery_fee : $details?->downpayment_amount);
            if ($amount <= 0) {
                continue;
            }
            DB::table('payment_records')->where('transaction_id', $tx->id)->where('payment_kind', $kind)->delete();
            DB::table('payment_records')->insert([
                'id' => (string) Str::uuid(), 'transaction_id' => $tx->id, 'amount' => $amount, 'method' => $method, 'recorded_by' => $tx->customer_id,
                'verified_by' => $tx->customer_id, 'settlement_date' => now()->toDateString(), 'payment_kind' => $kind, 'created_at' => now(),
            ]);
        }
    }

    /** Phase 6 stand-in: a cash payment recorded by the Sales Manager and verified by the Head Accountant. */
    private function recordVerifiedPayment(object $tx, float $amount): void
    {
        $sm = DB::table('users')->where('email', 'sales_manager@gce.local')->value('id');
        $ha = DB::table('users')->where('email', 'head_accountant@gce.local')->value('id');
        DB::table('payment_records')->insert([
            'id' => (string) Str::uuid(), 'transaction_id' => $tx->id, 'amount' => $amount, 'method' => 'cash', 'recorded_by' => $sm, 'verified_by' => $ha,
            'settlement_date' => now()->toDateString(), 'payment_kind' => 'full', 'created_at' => now(),
        ]);
    }

    private function recordFinancingDownpayment(object $tx): void
    {
        $amount = (float) DB::table('payment_terms')->where('purchase_transaction_id', $tx->id)->value('down_payment');
        DB::table('payment_records')->where('transaction_id', $tx->id)->where('payment_kind', 'downpayment')->delete();
        DB::table('payment_records')->insert([
            'id' => (string) Str::uuid(), 'transaction_id' => $tx->id, 'amount' => $amount, 'method' => 'bank_transfer', 'recorded_by' => $tx->customer_id,
            'verified_by' => $tx->customer_id, 'settlement_date' => now()->toDateString(), 'payment_kind' => 'downpayment', 'created_at' => now(),
        ]);
        DB::table('transactions')->where('id', $tx->id)->update(['flow_status' => 'initial_dp_confirmed', 'updated_at' => now()]);
    }

    /** Closes a financing plan as fully paid (moves the clock past every installment; Phase 6 owns the real flow). */
    private function markFinancingPaid(object $tx): void
    {
        $account = DB::table('installment_accounts')->where('purchase_transaction_id', $tx->id)->value('id') ?? throw new \RuntimeException('Financing account not found.');
        $today = now('Asia/Manila')->toDateString();
        DB::table('installments')->where('account_id', $account)->update(['state' => 'paid', 'payment_date' => $today]);
        DB::table('installment_accounts')->where('id', $account)->update(['state' => 'closed', 'closed_date' => $today]);
        DB::table('payment_terms')->where('purchase_transaction_id', $tx->id)->update(['state' => 'completed']);
        DB::table('transactions')->where('id', $tx->id)->update(['flow_status' => 'financing_completed']);
    }

    /** Child tables the specs embed, with their key back to the parent row (PostgREST-style `child(cols)`). */
    private const EMBEDS = ['transactions.purchase_details' => 'transaction_id', 'installment_accounts.installments' => 'account_id'];

    /**
     * Test-only read/update for the specs' assertions and clock moves (was the Supabase service-role client in
     * src/tests/e2e/support/t01.ts db()). Spec: {table, select, filters: [[op, column, value]], order, limit, update, single}.
     * Identifiers are checked against the schema; values are bound.
     */
    private function query(array $spec): mixed
    {
        $name = fn (mixed $id) => is_string($id) && preg_match('/^[a-z_]+$/', $id) ? $id : throw new \InvalidArgumentException('Bad identifier.');
        $table = $name($spec['table'] ?? null);
        abort_unless(\Illuminate\Support\Facades\Schema::hasTable($table), 422, 'Unknown table.');
        $query = DB::table($table);
        foreach ($spec['filters'] ?? [] as [$op, $column, $value]) {
            match ($op) {
                'eq' => $query->where($name($column), $value),
                'neq' => $query->where($name($column), '!=', $value),
                'in' => $query->whereIn($name($column), (array) $value),
                'is' => $value === null ? $query->whereNull($name($column)) : $query->where($name($column), $value),
                'notnull' => $query->whereNotNull($name($column)),
                default => throw new \InvalidArgumentException('Bad filter.'),
            };
        }
        if (isset($spec['update'])) {
            $values = [];
            foreach ($spec['update'] as $column => $value) {
                $values[$name($column)] = $value;
            }

            return $query->update($values);
        }
        if (isset($spec['order'])) {
            $query->orderBy($name($spec['order'][0]), ($spec['order'][1] ?? true) ? 'asc' : 'desc');
        }
        if (isset($spec['limit'])) {
            $query->limit((int) $spec['limit']);
        }
        // "a, b, child(c, d)": plain columns plus one level of embedded children.
        $columns = [];
        $embeds = [];
        preg_match_all('/([a-z_*]+)(?:\(([^)]*)\))?/', (string) ($spec['select'] ?? '*'), $parts, PREG_SET_ORDER);
        foreach ($parts as $part) {
            if (isset($part[2])) {
                $embeds[$name($part[1])] = array_map('trim', explode(',', $part[2]));
            } else {
                $columns[] = $part[1] === '*' ? '*' : $name($part[1]);
            }
        }
        $rows = $query->get($columns ?: ['*'])->map(fn ($r) => (array) $r);
        foreach ($embeds as $child => $childColumns) {
            $key = self::EMBEDS["{$table}.{$child}"] ?? throw new \InvalidArgumentException('Unknown embed.');
            $rows = $rows->map(function ($row) use ($child, $childColumns, $key, $table, $name) {
                $parentId = $row['id'] ?? DB::table($table)->where('id', $row['id'] ?? null)->value('id');
                $children = DB::table($child)->where($key, $parentId)->get(array_map($name, $childColumns))->map(fn ($c) => (array) $c);
                // purchase_details is one row per transaction: PostgREST returned it as an object.
                $row[$child] = $child === 'purchase_details' ? $children->first() : $children->all();

                return $row;
            });
        }

        return ($spec['single'] ?? false) ? $rows->first() : $rows->all();
    }
}
