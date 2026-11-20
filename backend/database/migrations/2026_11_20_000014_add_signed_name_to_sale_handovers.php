<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sale_handovers', fn (Blueprint $table) => $table->string('signed_name', 150)->nullable());
    }

    public function down(): void
    {
        Schema::table('sale_handovers', fn (Blueprint $table) => $table->dropColumn('signed_name'));
    }
};
