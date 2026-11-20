<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * Plan Phase 8 (BH-4, SN-10).
 *
 * `rejection_reason` keeps why the Head Accountant rejected a fund request, so the person who asked for the
 * money reads the reason instead of a bare "Rejected" badge.
 *
 * `idempotency_key` makes an automatic ledger entry unique per source action: releasing a fund, confirming a
 * returned excess, reimbursing an expense or verifying a buyer payment each post at most once, even when the
 * browser retries the request. Manual entries keep a NULL key (MySQL and MariaDB allow many NULLs in a unique
 * index), so `recordEntry` is unchanged.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('disbursement_requests', function (Blueprint $table) {
            $table->text('rejection_reason')->nullable();
        });
        Schema::table('financial_entries', function (Blueprint $table) {
            $table->string('idempotency_key', 191)->nullable();
            $table->unique(['idempotency_key'], 'financial_entries_idempotency_key_unique');
        });
    }

    public function down(): void
    {
        Schema::table('financial_entries', function (Blueprint $table) {
            $table->dropUnique('financial_entries_idempotency_key_unique');
            $table->dropColumn('idempotency_key');
        });
        Schema::table('disbursement_requests', fn (Blueprint $table) => $table->dropColumn('rejection_reason'));
    }
};
