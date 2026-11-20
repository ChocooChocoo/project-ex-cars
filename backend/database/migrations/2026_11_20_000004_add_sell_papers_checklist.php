<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * Plan Phase 4 (SN-13 / SN-11): a seller declares the OR, the CR and the deed of sale instead of photographing them:
 * "has", "does not have" or (for the OR and CR) "expired". The papers themselves are inspected at the meet-up, so
 * the offer carries three answers in one JSON object keyed by document kind.
 *
 * Nullable on purpose: offers sent before this allows the checklist keep working off their uploaded files.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sell_details', function (Blueprint $table) {
            $table->json('papers_checklist')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('sell_details', fn (Blueprint $table) => $table->dropColumn('papers_checklist'));
    }
};
