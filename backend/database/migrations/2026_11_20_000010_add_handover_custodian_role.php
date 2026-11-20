<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
 * Process & Revision Notes line 159: the papers of a sold car are released to the Marketing Specialist (the seller
 * came for a GCE Visit) or to the Confidential Informant (the seller met halfway).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sale_handovers', function (Blueprint $table) {
            $table->string('custodian_role', 40)->nullable();
        });
        DB::statement("ALTER TABLE sale_handovers ADD CONSTRAINT sale_handovers_custodian_role_check CHECK (custodian_role IS NULL OR custodian_role IN ('marketing_specialist', 'confidential_informant'))");
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE sale_handovers DROP CONSTRAINT sale_handovers_custodian_role_check');
        Schema::table('sale_handovers', fn (Blueprint $table) => $table->dropColumn('custodian_role'));
    }
};
