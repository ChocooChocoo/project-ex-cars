<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
 * Plan Phase 2 (SH-14 / BH-8): a Meet Halfway pin is a point inside CALABARZON, and its address is composed from
 * the reverse-geocoded Region/Province/City/Barangay plus a typed block and lot.
 *
 * sell_details.meetup_lat / meetup_lng already exist (2026_11_18_000004); this adds the address beside them and the
 * whole point on purchase_details, which is where a buyer's midway meet-up is saved.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sell_details', function (Blueprint $table) {
            $table->string('meetup_address', 500)->nullable();
        });
        Schema::table('purchase_details', function (Blueprint $table) {
            $table->decimal('meetup_lat', 9, 6)->nullable();
            $table->decimal('meetup_lng', 9, 6)->nullable();
            $table->string('meetup_address', 500)->nullable();
        });
        DB::statement('ALTER TABLE purchase_details ADD CONSTRAINT purchase_details_meetup_lat_check CHECK (meetup_lat BETWEEN -90 AND 90)');
        DB::statement('ALTER TABLE purchase_details ADD CONSTRAINT purchase_details_meetup_lng_check CHECK (meetup_lng BETWEEN -180 AND 180)');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE purchase_details DROP CONSTRAINT purchase_details_meetup_lat_check');
        DB::statement('ALTER TABLE purchase_details DROP CONSTRAINT purchase_details_meetup_lng_check');
        Schema::table('purchase_details', fn (Blueprint $table) => $table->dropColumn(['meetup_lat', 'meetup_lng', 'meetup_address']));
        Schema::table('sell_details', fn (Blueprint $table) => $table->dropColumn('meetup_address'));
    }
};
