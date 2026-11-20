<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
 * Plan Phase 5 (SH-7): the seller meet-up inspection is part by part, so each answered part carries its own repair
 * cost and whether the seller had declared that issue. `notes` already exists; `part_replacements` keeps the
 * standalone inspection page's rows, and the seller meet-up report reads these two columns.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inspection_checklist_results', function (Blueprint $table) {
            $table->decimal('repair_cost', 12, 2)->nullable();
            $table->boolean('is_hidden_issue')->default(false);
        });
        DB::statement('ALTER TABLE inspection_checklist_results ADD CONSTRAINT inspection_checklist_results_repair_cost_check CHECK (((repair_cost IS NULL) OR (repair_cost >= 0)))');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE inspection_checklist_results DROP CONSTRAINT inspection_checklist_results_repair_cost_check');
        Schema::table('inspection_checklist_results', function (Blueprint $table) {
            $table->dropColumn(['repair_cost', 'is_hidden_issue']);
        });
    }
};
