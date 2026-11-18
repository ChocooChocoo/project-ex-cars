<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// Port of 20261118100000_t12_sell_meetup_point.sql: the Meet Halfway pin a seller sets on the map.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sell_details', function (Blueprint $table) {
            $table->decimal('meetup_lat', 9, 6)->nullable();
            $table->decimal('meetup_lng', 9, 6)->nullable();
        });
        DB::statement('ALTER TABLE sell_details ADD CONSTRAINT sell_details_meetup_lat_check CHECK (meetup_lat BETWEEN -90 AND 90)');
        DB::statement('ALTER TABLE sell_details ADD CONSTRAINT sell_details_meetup_lng_check CHECK (meetup_lng BETWEEN -180 AND 180)');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE sell_details DROP CHECK sell_details_meetup_lat_check');
        DB::statement('ALTER TABLE sell_details DROP CHECK sell_details_meetup_lng_check');
        Schema::table('sell_details', fn (Blueprint $table) => $table->dropColumn(['meetup_lat', 'meetup_lng']));
    }
};
