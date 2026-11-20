<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
 * Plan Phase 11 (BC-11): the Marketing Specialist describes the car's interior on the posting form (leather seats,
 * 7 seats, rear AC), and the showroom detail shows it under "Interior". Free text, so it stays nullable with the
 * same 1000-character ceiling the form and controller validate; `description` keeps the general write-up.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vehicles', function (Blueprint $table) {
            $table->text('interior_features')->nullable();
        });
        DB::statement('ALTER TABLE vehicles ADD CONSTRAINT vehicles_interior_features_check CHECK (((interior_features IS NULL) OR (char_length(interior_features) <= 1000)))');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE vehicles DROP CONSTRAINT vehicles_interior_features_check');
        Schema::table('vehicles', fn (Blueprint $table) => $table->dropColumn('interior_features'));
    }
};
