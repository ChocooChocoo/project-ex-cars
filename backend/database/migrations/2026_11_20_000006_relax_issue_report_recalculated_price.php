<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/*
 * Plan Phase 6 (SH-6): an approved revised ceiling is a MAXIMUM, not the price, so the Inspection Issue Report no
 * longer collects a recalculated price — the Marketing Specialist records the agreed price after the second
 * negotiation. The old CHECK required `recalculated_price` whenever `is_profitable` was true, which would reject
 * every new report. Only `new_ceiling` is required now; `recalculated_price` stays nullable and readable so reports
 * written before this change keep their figures in history.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE inspection_issue_reports DROP CONSTRAINT inspection_issue_reports_check');
        DB::statement('ALTER TABLE inspection_issue_reports ADD CONSTRAINT inspection_issue_reports_check CHECK (((NOT is_profitable) OR (new_ceiling IS NOT NULL)))');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE inspection_issue_reports DROP CONSTRAINT inspection_issue_reports_check');
        DB::statement('ALTER TABLE inspection_issue_reports ADD CONSTRAINT inspection_issue_reports_check CHECK (((NOT is_profitable) OR ((recalculated_price IS NOT NULL) AND (new_ceiling IS NOT NULL))))');
    }
};
