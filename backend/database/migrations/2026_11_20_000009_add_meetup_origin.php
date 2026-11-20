<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * Process & Revision Notes line 120: a halfway pin may only move a few kilometres from the suggested midpoint.
 * The midpoint is saved with the pin so Laravel can enforce the same radius as the map.
 */
return new class extends Migration
{
    public function up(): void
    {
        foreach (['sell_details', 'purchase_details'] as $table) {
            Schema::table($table, function (Blueprint $t) {
                $t->decimal('meetup_origin_lat', 9, 6)->nullable();
                $t->decimal('meetup_origin_lng', 9, 6)->nullable();
            });
        }
    }

    public function down(): void
    {
        foreach (['sell_details', 'purchase_details'] as $table) {
            Schema::table($table, fn (Blueprint $t) => $t->dropColumn(['meetup_origin_lat', 'meetup_origin_lng']));
        }
    }
};
