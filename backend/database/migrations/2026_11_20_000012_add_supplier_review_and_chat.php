<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
 * Process & Revision Notes lines 60-68: the Marketing Specialist chats with the supplier about a post, proposes the
 * purchase to the CEO with the market value, and the CEO approves or rejects it.
 *
 * The chat reuses `inquiries`: a supplier thread has no showroom vehicle yet, so `vehicle_id` becomes nullable and
 * the thread points at its post instead.
 */
return new class extends Migration
{
    private const KINDS = "'inquiry', 'buy_now', 'sell_negotiation', 'buy_financing'";

    public function up(): void
    {
        Schema::table('supplier_vehicle_posts', function (Blueprint $table) {
            $table->decimal('market_value', 12, 2)->nullable();
            $table->text('proposal_reason')->nullable();
            $table->uuid('proposed_by')->nullable();
            $table->timestamp('proposed_at')->nullable();
            $table->text('decision_reason')->nullable();
            $table->uuid('decided_by')->nullable();
            $table->timestamp('decided_at')->nullable();
        });

        Schema::table('inquiries', function (Blueprint $table) {
            $table->uuid('vehicle_id')->nullable()->change();
            $table->uuid('supplier_post_id')->nullable()->unique();
            $table->foreign('supplier_post_id', 'inquiries_supplier_post_id_fkey')->references('id')->on('supplier_vehicle_posts')->cascadeOnDelete();
        });
        DB::statement('ALTER TABLE inquiries DROP CONSTRAINT inquiries_intention_kind_check');
        DB::statement('ALTER TABLE inquiries ADD CONSTRAINT inquiries_intention_kind_check CHECK ((intention_kind IN ('.self::KINDS.", 'supplier_offer')))");
    }

    public function down(): void
    {
        DB::table('inquiries')->where('intention_kind', 'supplier_offer')->delete();
        DB::statement('ALTER TABLE inquiries DROP CONSTRAINT inquiries_intention_kind_check');
        DB::statement('ALTER TABLE inquiries ADD CONSTRAINT inquiries_intention_kind_check CHECK ((intention_kind IN ('.self::KINDS.')))');
        Schema::table('inquiries', function (Blueprint $table) {
            $table->dropForeign('inquiries_supplier_post_id_fkey');
            $table->dropUnique(['supplier_post_id']);
            $table->dropColumn('supplier_post_id');
            $table->uuid('vehicle_id')->nullable(false)->change();
        });
        Schema::table('supplier_vehicle_posts', fn (Blueprint $table) => $table->dropColumn([
            'market_value', 'proposal_reason', 'proposed_by', 'proposed_at', 'decision_reason', 'decided_by', 'decided_at',
        ]));
    }
};
