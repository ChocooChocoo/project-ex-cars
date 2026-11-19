<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// Phase 5: the OCR check is a queued job now (was Next.js after()), so a document shows 'pending' until the
// job writes 'verified', 'failed' or 'manual_review'.
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE transaction_documents DROP CONSTRAINT transaction_documents_auto_check_status_check');
        DB::statement("ALTER TABLE transaction_documents ADD CONSTRAINT transaction_documents_auto_check_status_check CHECK ((auto_check_status IN ('pending', 'verified', 'failed', 'manual_review')))");
    }

    public function down(): void
    {
        DB::table('transaction_documents')->where('auto_check_status', 'pending')->update(['auto_check_status' => 'manual_review']);
        DB::statement('ALTER TABLE transaction_documents DROP CONSTRAINT transaction_documents_auto_check_status_check');
        DB::statement("ALTER TABLE transaction_documents ADD CONSTRAINT transaction_documents_auto_check_status_check CHECK ((auto_check_status IN ('verified', 'failed', 'manual_review')))");
    }
};
