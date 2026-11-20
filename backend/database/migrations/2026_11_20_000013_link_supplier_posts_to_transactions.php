<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * Process & Revision Notes lines 70-93: once the CEO approves, GCE buys the supplier's vehicle through the same sell
 * pipeline as a customer's car (field case, purchase fund, inspection, reconditioning, posting). One sell
 * transaction per post; the unique key stops a retried assignment from opening a second one.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('supplier_vehicle_posts', function (Blueprint $table) {
            $table->uuid('transaction_id')->nullable()->unique();
            $table->foreign('transaction_id', 'supplier_vehicle_posts_transaction_id_fkey')->references('id')->on('transactions')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('supplier_vehicle_posts', function (Blueprint $table) {
            $table->dropForeign('supplier_vehicle_posts_transaction_id_fkey');
            $table->dropUnique(['transaction_id']);
            $table->dropColumn('transaction_id');
        });
    }
};
