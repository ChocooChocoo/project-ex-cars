<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
 * Plan Phase 7 (SN-8): a Meet Halfway seller meet-up closes only once its travel expenses are filed, but a trip can
 * honestly cost nothing. `no_expenses_at` is the Confidential Informant's explicit "No expenses for this trip"
 * confirmation: it satisfies the completion guard without inventing a zero-value expense row.
 *
 * The same migration re-derives `field_cases.expenses_cents` (SN-6) from the itemised expenses that are the real
 * source of truth, so the list column and the filed rows agree on existing data too.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('field_cases', function (Blueprint $table) {
            $table->dateTime('no_expenses_at', 6)->nullable();
        });
        DB::statement('UPDATE field_cases AS f SET expenses_cents = COALESCE((SELECT ROUND(SUM(e.amount) * 100) FROM field_case_expenses AS e WHERE e.field_case_id = f.id), 0)');
    }

    public function down(): void
    {
        Schema::table('field_cases', fn (Blueprint $table) => $table->dropColumn('no_expenses_at'));
    }
};
