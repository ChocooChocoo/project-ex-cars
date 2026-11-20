<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
 * Process & Revision Notes Part 1: suppliers get accounts (created by the Account Manager or self-registered and
 * approved) and post vehicles that only the Confidential Informant, the Marketing Specialist and the CEO see.
 */
return new class extends Migration
{
    private const ROLES = "'customer', 'ceo', 'account_manager', 'head_accountant', 'confidential_informant', 'marketing_specialist', 'mechanic', 'sales_manager', 'head_security', 'super_admin'";

    public function up(): void
    {
        DB::statement('ALTER TABLE user_roles DROP CONSTRAINT user_roles_role_check');
        DB::statement('ALTER TABLE user_roles ADD CONSTRAINT user_roles_role_check CHECK ((role IN ('.self::ROLES.", 'supplier')))");

        Schema::create('supplier_profiles', function (Blueprint $table) {
            $table->uuid('user_id')->primary();
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->string('company_name', 200);
            $table->string('approval_state', 20)->default('pending');
            $table->uuid('approved_by')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamps();
        });
        DB::statement("ALTER TABLE supplier_profiles ADD CONSTRAINT supplier_profiles_approval_state_check CHECK (approval_state IN ('pending', 'approved', 'rejected'))");

        Schema::create('supplier_vehicle_posts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('supplier_id');
            $table->foreign('supplier_id')->references('id')->on('users')->cascadeOnDelete();
            $table->string('make', 80);
            $table->string('model', 80);
            $table->unsignedSmallInteger('year');
            $table->unsignedInteger('mileage');
            $table->decimal('asking_price', 12, 2);
            $table->text('description')->nullable();
            // Private photo keys in the `supplier-posts` bucket.
            $table->json('photos');
            $table->string('state', 20)->default('posted');
            $table->timestamps();
            $table->index(['supplier_id', 'state']);
        });
        DB::statement("ALTER TABLE supplier_vehicle_posts ADD CONSTRAINT supplier_vehicle_posts_state_check CHECK (state IN ('posted', 'proposed', 'approved', 'rejected', 'assigned', 'purchased', 'withdrawn'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('supplier_vehicle_posts');
        Schema::dropIfExists('supplier_profiles');
        DB::statement('ALTER TABLE user_roles DROP CONSTRAINT user_roles_role_check');
        DB::statement('ALTER TABLE user_roles ADD CONSTRAINT user_roles_role_check CHECK ((role IN ('.self::ROLES.')))');
    }
};
