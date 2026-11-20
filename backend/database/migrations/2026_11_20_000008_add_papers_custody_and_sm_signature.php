<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
 * Plan Phase 10.
 *
 * SN-3 / SN-4: `vehicle_document_items` (in the schema since the Supabase port, never written) becomes the custody
 * record of the original papers GCE received from a seller: which sell transaction they came from, when, and where
 * they are now (`with_ci` after the Marketing Specialist sends the photos to the Confidential Informant, `released`
 * once a buyer's sale hands them over, `on_hold` when an unsuccessful sale returns them). `storage_path` already
 * exists and holds the captured photo.
 *
 * BC-3: a GCE-visit sale is signed in the app by the Sales Manager as GCE's representative, so the handover keeps
 * that signature and who drew it next to the buyer's and the CI's.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vehicle_document_items', function (Blueprint $table) {
            $table->uuid('source_transaction_id')->nullable();
            $table->string('custody_state', 20)->nullable();
            $table->dateTime('received_at', 6)->nullable();
        });
        DB::statement("ALTER TABLE vehicle_document_items ADD CONSTRAINT vehicle_document_items_custody_state_check CHECK (custody_state IS NULL OR custody_state IN ('with_ci', 'released', 'on_hold'))");
        Schema::table('vehicle_document_items', function (Blueprint $table) {
            $table->foreign('source_transaction_id', 'vehicle_document_items_source_transaction_id_fkey')->references('id')->on('transactions')->nullOnDelete();
        });

        Schema::table('sale_handovers', function (Blueprint $table) {
            $table->text('sm_signature_path')->nullable();
            $table->uuid('sm_signed_by')->nullable();
            $table->dateTime('sm_signed_at', 6)->nullable();
        });
        Schema::table('sale_handovers', function (Blueprint $table) {
            $table->foreign('sm_signed_by', 'sale_handovers_sm_signed_by_fkey')->references('id')->on('users');
        });
    }

    public function down(): void
    {
        Schema::table('sale_handovers', function (Blueprint $table) {
            $table->dropForeign('sale_handovers_sm_signed_by_fkey');
            $table->dropColumn(['sm_signature_path', 'sm_signed_by', 'sm_signed_at']);
        });
        Schema::table('vehicle_document_items', function (Blueprint $table) {
            $table->dropForeign('vehicle_document_items_source_transaction_id_fkey');
        });
        DB::statement('ALTER TABLE vehicle_document_items DROP CONSTRAINT vehicle_document_items_custody_state_check');
        Schema::table('vehicle_document_items', function (Blueprint $table) {
            $table->dropColumn(['source_transaction_id', 'custody_state', 'received_at']);
        });
    }
};
