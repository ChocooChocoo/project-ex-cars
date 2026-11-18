<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// Generated from the final state of supabase/migrations (116 files, last 20261116140000_t11_recondition_known_issues.sql).
// See docs/implementation-plan/laravel-mysql-migration/phase-2.md for the mapping rules.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('staff_compensation', function (Blueprint $table) {
            $table->uuid('id')->default(DB::raw('(UUID())'));
            $table->uuid('employee_id');
            $table->bigInteger('base_salary_cents');
            $table->date('effective_from');
            $table->date('effective_until')->nullable();
            $table->uuid('created_by');
            $table->dateTime('created_at', 6)->useCurrent();
            $table->bigInteger('sss_contribution_cents')->default(0);
            $table->bigInteger('pagibig_contribution_cents')->default(0);
            $table->bigInteger('philhealth_contribution_cents')->default(0);
            $table->text('tin_number')->nullable();
            $table->primary(['id']);
        });

        Schema::create('user_roles', function (Blueprint $table) {
            $table->uuid('id')->default(DB::raw('(UUID())'));
            $table->uuid('account_id');
            $table->string('role');
            $table->boolean('active')->default(true);
            $table->uuid('assigned_by')->nullable();
            $table->dateTime('assigned_at', 6)->useCurrent();
            $table->primary(['id']);
            $table->unique(['account_id'], 'user_roles_account_id_key');
        });

        Schema::create('announcements', function (Blueprint $table) {
            $table->uuid('id')->default(DB::raw('(UUID())'));
            $table->text('title');
            $table->text('body');
            $table->string('status')->default('draft');
            $table->uuid('author_id');
            $table->dateTime('published_at', 6)->nullable();
            $table->dateTime('expires_at', 6)->nullable();
            $table->dateTime('created_at', 6)->useCurrent();
            $table->dateTime('updated_at', 6)->useCurrent();
            $table->primary(['id']);
        });

        Schema::create('app_settings', function (Blueprint $table) {
            $table->string('key');
            $table->uuid('id')->default(DB::raw('(UUID())'));
            $table->json('value');
            $table->uuid('updated_by')->nullable();
            $table->dateTime('updated_at', 6)->useCurrent();
            $table->primary(['key']);
            $table->unique(['id'], 'app_settings_id_key');
        });

        Schema::create('attendance_entries', function (Blueprint $table) {
            $table->uuid('id')->default(DB::raw('(UUID())'));
            $table->uuid('employee_id');
            $table->date('attendance_date')->default(DB::raw('(CURRENT_DATE)'));
            $table->dateTime('time_in', 6)->nullable();
            $table->dateTime('time_out', 6)->nullable();
            $table->decimal('hours_worked', 4, 2)->nullable()->storedAs('CASE WHEN time_in IS NOT NULL AND time_out IS NOT NULL THEN ROUND(TIMESTAMPDIFF(MICROSECOND, time_in, time_out) / 3600000000, 2) ELSE NULL END');
            $table->string('status')->default('present');
            $table->text('notes')->nullable();
            $table->uuid('checked_by')->nullable();
            $table->dateTime('checked_at', 6)->nullable();
            $table->dateTime('created_at', 6)->useCurrent();
            $table->dateTime('updated_at', 6)->useCurrent();
            $table->dateTime('scheduled_start_at', 6)->nullable();
            $table->dateTime('scheduled_end_at', 6)->nullable();
            $table->integer('applied_grace_minutes')->nullable();
            $table->text('schedule_timezone')->nullable();
            $table->integer('late_minutes')->nullable();
            $table->double('clock_in_lat')->nullable();
            $table->double('clock_in_lng')->nullable();
            $table->double('clock_in_distance_m')->nullable();
            $table->primary(['id']);
            $table->unique(['employee_id', 'attendance_date'], 'uq_attendance_employee_date');
        });

        Schema::create('audit_events', function (Blueprint $table) {
            $table->uuid('id')->default(DB::raw('(UUID())'));
            $table->uuid('actor_id');
            $table->text('action');
            $table->string('record_kind');
            $table->uuid('record_id');
            $table->text('summary');
            $table->dateTime('created_at', 6)->useCurrent();
            $table->primary(['id']);
        });

        Schema::create('collection_actions', function (Blueprint $table) {
            $table->uuid('id')->default(DB::raw('(UUID())'));
            $table->uuid('installment_id');
            $table->string('action_kind');
            $table->uuid('actor_id');
            $table->date('deadline')->nullable();
            $table->text('notes')->nullable();
            $table->dateTime('action_time', 6)->useCurrent();
            $table->primary(['id']);
        });

        Schema::create('content_items', function (Blueprint $table) {
            $table->uuid('id')->default(DB::raw('(UUID())'));
            $table->string('content_kind');
            $table->uuid('vehicle_id')->nullable();
            $table->text('title');
            $table->text('body')->nullable();
            $table->text('image_path')->nullable();
            $table->uuid('author_id');
            $table->string('publication_state')->default('draft');
            $table->dateTime('published_at', 6)->nullable();
            $table->dateTime('expires_at', 6)->nullable();
            $table->dateTime('created_at', 6)->useCurrent();
            $table->dateTime('updated_at', 6)->useCurrent();
            $table->primary(['id']);
        });

        Schema::create('customer_documents', function (Blueprint $table) {
            $table->uuid('id')->default(DB::raw('(UUID())'));
            $table->uuid('customer_id');
            $table->text('document_kind');
            $table->text('storage_path');
            $table->string('verification_state')->default('pending');
            $table->uuid('verified_by')->nullable();
            $table->dateTime('verified_at', 6)->nullable();
            $table->dateTime('created_at', 6)->useCurrent();
            $table->primary(['id']);
        });

        Schema::create('customer_reviews', function (Blueprint $table) {
            $table->uuid('id')->default(DB::raw('(UUID())'));
            $table->uuid('transaction_id');
            $table->uuid('customer_id');
            $table->uuid('vehicle_id')->nullable();
            $table->integer('rating');
            $table->text('body');
            $table->string('state')->default('published');
            $table->dateTime('created_at', 6)->useCurrent();
            $table->dateTime('updated_at', 6)->useCurrent();
            $table->primary(['id']);
            $table->unique(['transaction_id'], 'customer_reviews_transaction_id_key');
        });

        Schema::create('customer_standing', function (Blueprint $table) {
            $table->uuid('account_id');
            $table->integer('no_show_count')->default(0);
            $table->integer('strike_count')->default(0);
            $table->boolean('gce_visit_only')->default(false);
            $table->uuid('updated_by')->nullable();
            $table->dateTime('updated_at', 6)->useCurrent();
            $table->primary(['account_id']);
        });

        Schema::create('disbursement_events', function (Blueprint $table) {
            $table->uuid('id')->default(DB::raw('(UUID())'));
            $table->uuid('disbursement_id');
            $table->string('event_kind');
            $table->uuid('actor_id');
            $table->text('notes')->nullable();
            $table->dateTime('created_at', 6)->useCurrent();
            $table->primary(['id']);
        });

        Schema::create('disbursement_requests', function (Blueprint $table) {
            $table->uuid('id')->default(DB::raw('(UUID())'));
            $table->text('title');
            $table->bigInteger('amount_cents');
            $table->text('purpose');
            $table->string('status')->default('draft');
            $table->uuid('requested_by');
            $table->uuid('approved_by')->nullable();
            $table->uuid('released_by')->nullable();
            $table->uuid('received_by')->nullable();
            $table->text('evidence_storage_path')->nullable();
            $table->text('notes')->nullable();
            $table->dateTime('created_at', 6)->useCurrent();
            $table->dateTime('updated_at', 6)->useCurrent();
            $table->uuid('purchase_transaction_id')->nullable();
            $table->uuid('field_case_id')->nullable();
            $table->bigInteger('returned_cents')->nullable();
            $table->dateTime('returned_at', 6)->nullable();
            $table->uuid('return_confirmed_by')->nullable();
            $table->dateTime('return_confirmed_at', 6)->nullable();
            $table->uuid('uq_live_field_case_id')->nullable()->virtualAs("IF(field_case_id IS NOT NULL AND status <> 'rejected', field_case_id, NULL)")->invisible();
            $table->primary(['id']);
            $table->unique(['uq_live_field_case_id'], 'disbursement_requests_one_live_field_budget');
        });

        Schema::create('employee_request_attachments', function (Blueprint $table) {
            $table->uuid('id')->default(DB::raw('(UUID())'));
            $table->uuid('request_id');
            $table->text('storage_path');
            $table->text('original_name');
            $table->string('file_kind')->default('file');
            $table->integer('file_size')->nullable();
            $table->uuid('uploader_id');
            $table->dateTime('created_at', 6)->useCurrent();
            $table->primary(['id']);
        });

        Schema::create('employee_requests', function (Blueprint $table) {
            $table->uuid('id')->default(DB::raw('(UUID())'));
            $table->uuid('employee_id');
            $table->string('request_kind');
            $table->string('status')->default('pending');
            $table->date('start_date');
            $table->date('end_date')->nullable();
            $table->text('reason')->nullable();
            $table->uuid('reviewed_by')->nullable();
            $table->text('review_notes')->nullable();
            $table->dateTime('reviewed_at', 6)->nullable();
            $table->dateTime('created_at', 6)->useCurrent();
            $table->dateTime('updated_at', 6)->useCurrent();
            $table->string('leave_reason')->nullable();
            $table->decimal('overtime_hours', 4, 2)->nullable();
            $table->primary(['id']);
        });

        Schema::create('employee_work_schedules', function (Blueprint $table) {
            $table->uuid('id')->default(DB::raw('(UUID())'));
            $table->uuid('employee_id');
            $table->json('workdays');
            $table->time('start_time');
            $table->time('end_time');
            $table->integer('grace_minutes')->default(10);
            $table->string('timezone')->default('Asia/Manila');
            $table->uuid('created_by');
            $table->uuid('updated_by');
            $table->dateTime('created_at', 6)->useCurrent();
            $table->dateTime('updated_at', 6)->useCurrent();
            $table->primary(['id']);
            $table->unique(['employee_id'], 'employee_work_schedules_employee_id_key');
        });

        Schema::create('favourites', function (Blueprint $table) {
            $table->uuid('id')->default(DB::raw('(UUID())'));
            $table->uuid('customer_id');
            $table->uuid('vehicle_id');
            $table->dateTime('saved_at', 6)->useCurrent();
            $table->primary(['id']);
            $table->unique(['customer_id', 'vehicle_id'], 'favourites_customer_id_vehicle_id_key');
        });

        Schema::create('field_case_expenses', function (Blueprint $table) {
            $table->uuid('id')->default(DB::raw('(UUID())'));
            $table->uuid('field_case_id');
            $table->decimal('amount', 12, 2);
            $table->text('description');
            $table->uuid('proof_document_id');
            $table->uuid('submitted_by');
            $table->dateTime('submitted_at', 6)->useCurrent();
            $table->dateTime('reimbursed_at', 6)->nullable();
            $table->uuid('reimbursed_by')->nullable();
            $table->primary(['id']);
        });

        Schema::create('field_cases', function (Blueprint $table) {
            $table->uuid('id')->default(DB::raw('(UUID())'));
            $table->uuid('vehicle_id')->nullable();
            $table->uuid('transaction_id')->nullable();
            $table->string('case_kind');
            $table->uuid('assigned_confidential_informant')->nullable();
            $table->uuid('mechanic_id')->nullable();
            $table->dateTime('schedule', 6)->nullable();
            $table->text('location')->nullable();
            $table->string('state')->default('assigned');
            $table->dateTime('completion_date', 6)->nullable();
            $table->dateTime('created_at', 6)->useCurrent();
            $table->dateTime('updated_at', 6)->useCurrent();
            $table->bigInteger('expenses_cents')->nullable()->default(0);
            $table->dateTime('accepted_at', 6)->nullable();
            $table->text('notes')->nullable();
            $table->dateTime('identity_confirmed_at', 6)->nullable();
            $table->uuid('identity_confirmed_by')->nullable();
            $table->dateTime('plate_confirmed_at', 6)->nullable();
            $table->uuid('plate_confirmed_by')->nullable();
            $table->string('inspection_outcome')->nullable();
            $table->text('issue_description')->nullable();
            $table->decimal('repair_estimate', 12, 2)->nullable();
            $table->dateTime('inspected_at', 6)->nullable();
            $table->uuid('head_security_id')->nullable();
            $table->string('delivery_status')->nullable();
            $table->text('delay_note')->nullable();
            $table->dateTime('expected_arrival', 6)->nullable();
            $table->dateTime('ci_received_at', 6)->nullable();
            $table->dateTime('mechanic_received_at', 6)->nullable();
            $table->string('price_status')->nullable();
            $table->decimal('updated_price', 12, 2)->nullable();
            $table->decimal('discount_amount', 12, 2)->nullable();
            $table->double('last_lat')->nullable();
            $table->double('last_lng')->nullable();
            $table->dateTime('last_located_at', 6)->nullable();
            $table->primary(['id']);
        });

        Schema::create('financial_entries', function (Blueprint $table) {
            $table->uuid('id')->default(DB::raw('(UUID())'));
            $table->string('entry_kind');
            $table->bigInteger('amount_cents');
            $table->uuid('transaction_id')->nullable();
            $table->uuid('field_case_id')->nullable();
            $table->text('description');
            $table->uuid('recorded_by');
            $table->dateTime('recorded_at', 6)->useCurrent();
            $table->uuid('verified_by')->nullable();
            $table->dateTime('verified_at', 6)->nullable();
            $table->dateTime('created_at', 6)->useCurrent();
            $table->primary(['id']);
        });

        Schema::create('inquiries', function (Blueprint $table) {
            $table->uuid('id')->default(DB::raw('(UUID())'));
            $table->uuid('customer_id');
            $table->uuid('vehicle_id');
            $table->string('intention_kind');
            $table->uuid('assigned_account_manager')->nullable();
            $table->uuid('assigned_sales_manager')->nullable();
            $table->string('handoff_state')->default('none');
            $table->string('state')->default('open');
            $table->dateTime('created_at', 6)->useCurrent();
            $table->dateTime('updated_at', 6)->useCurrent();
            $table->uuid('transaction_id')->nullable();
            $table->primary(['id']);
        });

        Schema::create('inquiry_messages', function (Blueprint $table) {
            $table->uuid('id')->default(DB::raw('(UUID())'));
            $table->uuid('inquiry_id');
            $table->uuid('sender_id');
            $table->text('message_text')->nullable();
            $table->text('image_path')->nullable();
            $table->dateTime('sent_at', 6)->useCurrent();
            $table->dateTime('read_at', 6)->nullable();
            $table->primary(['id']);
        });

        Schema::create('inspection_checklist_nodes', function (Blueprint $table) {
            $table->uuid('id')->default(DB::raw('(UUID())'));
            $table->uuid('parent_id')->nullable();
            $table->string('level');
            $table->text('name');
            $table->integer('display_order')->default(0);
            $table->string('checklist_version')->default('1.0');
            $table->boolean('active')->default(true);
            $table->dateTime('created_at', 6)->useCurrent();
            $table->primary(['id']);
        });

        Schema::create('inspection_checklist_results', function (Blueprint $table) {
            $table->uuid('id')->default(DB::raw('(UUID())'));
            $table->uuid('inspection_id');
            $table->uuid('checklist_entry_id');
            $table->string('status');
            $table->text('notes')->nullable();
            $table->dateTime('answered_at', 6)->useCurrent();
            $table->primary(['id']);
            $table->unique(['inspection_id', 'checklist_entry_id'], 'inspection_checklist_results_inspection_id_checklist_entry__key');
        });

        Schema::create('inspection_issue_reports', function (Blueprint $table) {
            $table->uuid('id')->default(DB::raw('(UUID())'));
            $table->uuid('transaction_id');
            $table->uuid('field_case_id');
            $table->text('issue_found');
            $table->decimal('repair_estimate', 12, 2);
            $table->boolean('is_profitable');
            $table->text('profitability_reason');
            $table->decimal('recalculated_price', 12, 2)->nullable();
            $table->decimal('new_ceiling', 12, 2)->nullable();
            $table->uuid('proposal_id')->nullable();
            $table->string('seller_response')->nullable();
            $table->dateTime('seller_response_at', 6)->nullable();
            $table->uuid('created_by');
            $table->dateTime('created_at', 6)->useCurrent();
            $table->text('seller_remarks')->nullable();
            $table->primary(['id']);
            $table->unique(['field_case_id'], 'inspection_issue_reports_field_case_id_key');
        });

        Schema::create('installment_accounts', function (Blueprint $table) {
            $table->uuid('id')->default(DB::raw('(UUID())'));
            $table->uuid('purchase_transaction_id');
            $table->decimal('financed_total', 12, 2);
            $table->decimal('down_payment', 12, 2)->default(0);
            $table->decimal('opening_balance', 12, 2);
            $table->date('start_date');
            $table->string('state')->default('active');
            $table->date('closed_date')->nullable();
            $table->dateTime('created_at', 6)->useCurrent();
            $table->dateTime('updated_at', 6)->useCurrent();
            $table->dateTime('flagged_at', 6)->nullable();
            $table->primary(['id']);
            $table->unique(['purchase_transaction_id'], 'installment_accounts_purchase_transaction_id_key');
        });

        Schema::create('installments', function (Blueprint $table) {
            $table->uuid('id')->default(DB::raw('(UUID())'));
            $table->uuid('account_id');
            $table->integer('sequence_no');
            $table->date('due_date');
            $table->decimal('amount_due', 12, 2);
            $table->string('state')->default('upcoming');
            $table->date('payment_date')->nullable();
            $table->primary(['id']);
            $table->unique(['account_id', 'sequence_no'], 'installments_account_id_sequence_no_key');
        });

        Schema::create('message_attachments', function (Blueprint $table) {
            $table->uuid('id')->default(DB::raw('(UUID())'));
            $table->uuid('message_id');
            $table->string('file_kind')->default('file');
            $table->text('storage_path');
            $table->text('original_name');
            $table->integer('file_size')->nullable();
            $table->uuid('uploader_id');
            $table->dateTime('uploaded_at', 6)->useCurrent();
            $table->primary(['id']);
        });

        Schema::create('message_reports', function (Blueprint $table) {
            $table->uuid('id')->default(DB::raw('(UUID())'));
            $table->uuid('reported_message_id')->nullable();
            $table->uuid('reported_inquiry_id')->nullable();
            $table->uuid('reporter_id');
            $table->text('reason');
            $table->string('state')->default('open');
            $table->uuid('reviewer_id')->nullable();
            $table->dateTime('decision_date', 6)->nullable();
            $table->dateTime('created_at', 6)->useCurrent();
            $table->primary(['id']);
        });

        Schema::create('notifications', function (Blueprint $table) {
            $table->uuid('id')->default(DB::raw('(UUID())'));
            $table->string('recipient_role')->nullable();
            $table->text('kind');
            $table->text('title');
            $table->text('body')->nullable();
            $table->boolean('is_read')->default(false);
            $table->string('reference_table')->nullable();
            $table->uuid('reference_id')->nullable();
            $table->dateTime('created_at', 6)->useCurrent();
            $table->uuid('recipient_id')->nullable();
            $table->primary(['id']);
        });

        Schema::create('part_replacements', function (Blueprint $table) {
            $table->uuid('id')->default(DB::raw('(UUID())'));
            $table->uuid('checklist_answer_id');
            $table->text('item_name');
            $table->text('brand')->nullable();
            $table->decimal('estimated_cost', 12, 2)->nullable();
            $table->dateTime('recorded_at', 6)->useCurrent();
            $table->primary(['id']);
        });

        Schema::create('payment_records', function (Blueprint $table) {
            $table->uuid('id')->default(DB::raw('(UUID())'));
            $table->uuid('transaction_id');
            $table->uuid('installment_id')->nullable();
            $table->decimal('amount', 12, 2);
            $table->string('method');
            $table->text('external_reference')->nullable();
            $table->uuid('recorded_by');
            $table->uuid('verified_by')->nullable();
            $table->date('settlement_date');
            $table->dateTime('created_at', 6)->useCurrent();
            $table->string('payment_kind')->nullable();
            $table->string('paymongo_checkout_id')->nullable();
            $table->text('paymongo_payment_id')->nullable();
            $table->dateTime('paid_at', 6)->nullable();
            $table->text('proof_path')->nullable();
            $table->uuid('rejected_by')->nullable();
            $table->dateTime('rejected_at', 6)->nullable();
            $table->text('rejection_reason')->nullable();
            $table->uuid('submitted_by')->nullable();
            $table->uuid('approved_by')->nullable();
            $table->dateTime('approved_at', 6)->nullable();
            $table->smallInteger('part_no')->default(1);
            $table->uuid('uq_live_installment_id')->nullable()->virtualAs("IF(installment_id IS NOT NULL AND rejected_at IS NULL, installment_id, NULL)")->invisible();
            $table->string('uq_once_kind')->nullable()->virtualAs("IF(installment_id IS NULL AND rejected_at IS NULL AND payment_kind <> 'reschedule_fee', payment_kind, NULL)")->invisible();
            $table->primary(['id']);
            $table->unique(['transaction_id', 'uq_live_installment_id'], 'payment_records_live_installment_unique');
            $table->unique(['transaction_id', 'uq_once_kind', 'part_no'], 'payment_records_once_per_kind_part');
        });

        Schema::create('payment_reminders_sent', function (Blueprint $table) {
            $table->uuid('installment_id');
            $table->integer('days_before');
            $table->dateTime('sent_at', 6)->useCurrent();
            $table->primary(['installment_id', 'days_before']);
        });

        Schema::create('payment_terms', function (Blueprint $table) {
            $table->uuid('id')->default(DB::raw('(UUID())'));
            $table->uuid('purchase_transaction_id');
            $table->text('arrangement_description');
            $table->decimal('total_amount', 12, 2);
            $table->decimal('down_payment', 12, 2)->default(0);
            $table->integer('number_of_payments');
            $table->string('payment_frequency');
            $table->date('first_due_date');
            $table->uuid('agreed_by');
            $table->uuid('approver_id')->nullable();
            $table->dateTime('approval_date', 6)->nullable();
            $table->string('state')->default('proposed');
            $table->dateTime('created_at', 6)->useCurrent();
            $table->dateTime('updated_at', 6)->useCurrent();
            $table->integer('duration_months')->nullable();
            $table->uuid('ha_reviewed_by')->nullable();
            $table->dateTime('ha_reviewed_at', 6)->nullable();
            $table->text('returned_reason')->nullable();
            $table->decimal('monthly_payment', 12, 2)->nullable();
            $table->text('missed_payment_policy')->nullable();
            $table->decimal('delivery_fee', 12, 2)->nullable();
            $table->primary(['id']);
            $table->unique(['purchase_transaction_id'], 'payment_terms_purchase_transaction_id_key');
        });

        Schema::create('payroll_approvals', function (Blueprint $table) {
            $table->uuid('id')->default(DB::raw('(UUID())'));
            $table->uuid('payroll_run_id');
            $table->integer('sequence')->default(1);
            $table->uuid('reviewer_id');
            $table->string('decision');
            $table->text('notes')->nullable();
            $table->dateTime('created_at', 6)->useCurrent();
            $table->primary(['id']);
        });

        Schema::create('payroll_runs', function (Blueprint $table) {
            $table->uuid('id')->default(DB::raw('(UUID())'));
            $table->date('period_start');
            $table->date('period_end');
            $table->string('status')->default('draft');
            $table->uuid('prepared_by');
            $table->bigInteger('total_gross_cents')->default(0);
            $table->bigInteger('total_deductions_cents')->default(0);
            $table->bigInteger('total_net_cents')->default(0);
            $table->text('notes')->nullable();
            $table->dateTime('created_at', 6)->useCurrent();
            $table->dateTime('updated_at', 6)->useCurrent();
            $table->primary(['id']);
            $table->unique(['period_start', 'period_end'], 'uq_payroll_period');
        });

        Schema::create('payslip_items', function (Blueprint $table) {
            $table->uuid('id')->default(DB::raw('(UUID())'));
            $table->uuid('payslip_id');
            $table->string('item_kind');
            $table->text('label');
            $table->bigInteger('amount_cents');
            $table->text('source_value')->nullable();
            $table->text('calculation_note')->nullable();
            $table->dateTime('created_at', 6)->useCurrent();
            $table->primary(['id']);
        });

        Schema::create('payslips', function (Blueprint $table) {
            $table->uuid('id')->default(DB::raw('(UUID())'));
            $table->uuid('payroll_run_id');
            $table->uuid('employee_id');
            $table->bigInteger('gross_cents')->default(0);
            $table->bigInteger('deductions_cents')->default(0);
            $table->bigInteger('net_cents')->default(0);
            $table->string('status')->default('draft');
            $table->dateTime('finalized_at', 6)->nullable();
            $table->dateTime('created_at', 6)->useCurrent();
            $table->string('payment_status')->default('pending');
            $table->dateTime('paid_at', 6)->nullable();
            $table->uuid('paid_by')->nullable();
            $table->primary(['id']);
            $table->unique(['employee_id', 'payroll_run_id'], 'uq_payslip_employee_run');
        });

        Schema::create('performance_reviews', function (Blueprint $table) {
            $table->uuid('id')->default(DB::raw('(UUID())'));
            $table->uuid('employee_id');
            $table->uuid('reviewer_id');
            $table->date('review_period_start');
            $table->date('review_period_end');
            $table->integer('rating')->nullable();
            $table->text('strengths')->nullable();
            $table->text('areas_for_improvement')->nullable();
            $table->text('goals')->nullable();
            $table->string('status')->default('draft');
            $table->dateTime('acknowledged_at', 6)->nullable();
            $table->dateTime('created_at', 6)->useCurrent();
            $table->dateTime('updated_at', 6)->useCurrent();
            $table->primary(['id']);
        });

        Schema::create('profiles', function (Blueprint $table) {
            $table->uuid('id');
            $table->text('full_name')->nullable();
            $table->text('address')->nullable();
            $table->text('phone')->nullable();
            $table->string('account_state')->default('active');
            $table->uuid('created_by')->nullable();
            $table->dateTime('activated_at', 6)->nullable();
            $table->dateTime('created_at', 6)->useCurrent();
            $table->dateTime('updated_at', 6)->useCurrent();
            $table->text('avatar_url')->nullable();
            $table->text('address_line')->nullable();
            $table->text('region_code')->nullable();
            $table->text('province_code')->nullable();
            $table->text('city_code')->nullable();
            $table->text('barangay_code')->nullable();
            $table->dateTime('tutorial_completed_at', 6)->nullable();
            $table->primary(['id']);
        });

        Schema::create('purchase_details', function (Blueprint $table) {
            $table->uuid('id')->default(DB::raw('(UUID())'));
            $table->uuid('transaction_id');
            $table->string('payment_method');
            $table->decimal('final_price', 12, 2)->nullable();
            $table->string('arrangement_kind')->nullable();
            $table->string('document_check_state')->default('pending');
            $table->uuid('checked_by')->nullable();
            $table->dateTime('checked_at', 6)->nullable();
            $table->dateTime('created_at', 6)->useCurrent();
            $table->dateTime('updated_at', 6)->useCurrent();
            $table->dateTime('condition_acknowledged_at', 6)->nullable();
            $table->boolean('delivery_serviceable')->nullable();
            $table->decimal('delivery_fee', 12, 2)->nullable();
            $table->decimal('downpayment_amount', 12, 2)->nullable();
            $table->dateTime('downpayment_due_at', 6)->nullable();
            $table->dateTime('downpayment_forfeited_at', 6)->nullable();
            $table->integer('requested_term_months')->nullable();
            $table->dateTime('delivery_terms_agreed_at', 6)->nullable();
            $table->string('payment_option')->nullable();
            $table->text('location')->nullable();
            $table->dateTime('cancellation_towing_ack_at', 6)->nullable();
            $table->uuid('cancellation_towing_ack_by')->nullable();
            $table->dateTime('reschedule_pending_at', 6)->nullable();
            $table->text('reschedule_pending_location')->nullable();
            $table->string('financing_pay_method')->nullable()->default('paymongo');
            $table->primary(['id']);
            $table->unique(['transaction_id'], 'purchase_details_transaction_id_key');
        });

        Schema::create('rbac_access_areas', function (Blueprint $table) {
            $table->string('key');
            $table->text('label');
            $table->integer('sort_order');
            $table->primary(['key']);
            $table->unique(['sort_order'], 'rbac_access_areas_sort_order_key');
        });

        Schema::create('rbac_actions', function (Blueprint $table) {
            $table->string('key');
            $table->text('label');
            $table->integer('sort_order');
            $table->primary(['key']);
            $table->unique(['sort_order'], 'rbac_actions_sort_order_key');
        });

        Schema::create('rbac_permissions', function (Blueprint $table) {
            $table->uuid('id')->default(DB::raw('(UUID())'));
            $table->string('access_area_key');
            $table->string('action_key');
            $table->string('access_label')->nullable();
            $table->string('permission_key')->storedAs("CONCAT(access_area_key, '.', action_key)");
            $table->text('description')->nullable();
            $table->string('status')->default('active');
            $table->dateTime('created_at', 6)->useCurrent();
            $table->primary(['id']);
            $table->unique(['access_area_key', 'action_key'], 'rbac_permissions_access_area_key_action_key_key');
            $table->unique(['permission_key'], 'rbac_permissions_permission_key_key');
        });

        Schema::create('rbac_role_permissions', function (Blueprint $table) {
            $table->string('role_key');
            $table->uuid('permission_id');
            $table->dateTime('assigned_at', 6)->useCurrent();
            $table->primary(['role_key', 'permission_id']);
        });

        Schema::create('rbac_roles', function (Blueprint $table) {
            $table->string('role_key');
            $table->text('description')->nullable();
            $table->string('status')->default('active');
            $table->boolean('is_protected')->default(false);
            $table->dateTime('created_at', 6)->useCurrent();
            $table->dateTime('updated_at', 6)->useCurrent();
            $table->primary(['role_key']);
        });

        Schema::create('recommendation_feedback', function (Blueprint $table) {
            $table->uuid('id')->default(DB::raw('(UUID())'));
            $table->uuid('run_id');
            $table->uuid('selected_vehicle_id');
            $table->string('helpful_state')->default('unknown');
            $table->uuid('resulting_transaction_id')->nullable();
            $table->text('outcome')->nullable();
            $table->dateTime('feedback_date', 6)->useCurrent();
            $table->primary(['id']);
        });

        Schema::create('recommendation_results', function (Blueprint $table) {
            $table->uuid('id')->default(DB::raw('(UUID())'));
            $table->uuid('run_id');
            $table->uuid('vehicle_id');
            $table->decimal('budget_score', 5, 2);
            $table->decimal('condition_score', 5, 2);
            $table->decimal('fuel_score', 5, 2);
            $table->decimal('demand_score', 5, 2);
            $table->decimal('mileage_score', 5, 2);
            $table->decimal('total_score', 5, 2);
            $table->integer('rank');
            $table->primary(['id']);
        });

        Schema::create('recommendation_runs', function (Blueprint $table) {
            $table->uuid('id')->default(DB::raw('(UUID())'));
            $table->uuid('customer_id');
            $table->decimal('budget', 12, 2);
            $table->text('stated_preferences')->nullable();
            $table->string('criteria_version')->default('1.0');
            $table->dateTime('run_date', 6)->useCurrent();
            $table->primary(['id']);
        });

        Schema::create('reconditioning_fund_receipts', function (Blueprint $table) {
            $table->uuid('id')->default(DB::raw('(UUID())'));
            $table->uuid('fund_request_id');
            $table->text('storage_path');
            $table->uuid('uploaded_by');
            $table->dateTime('created_at', 6)->useCurrent();
            $table->primary(['id']);
        });

        Schema::create('reconditioning_fund_requests', function (Blueprint $table) {
            $table->uuid('id')->default(DB::raw('(UUID())'));
            $table->uuid('job_id');
            $table->uuid('disbursement_id')->nullable();
            $table->bigInteger('amount_cents');
            $table->text('reason');
            $table->text('shortfall_reason')->nullable();
            $table->string('state')->default('draft');
            $table->uuid('created_by');
            $table->dateTime('created_at', 6)->useCurrent();
            $table->dateTime('updated_at', 6)->useCurrent();
            $table->primary(['id']);
            $table->unique(['disbursement_id'], 'reconditioning_fund_requests_disbursement_id_key');
        });

        Schema::create('reconditioning_jobs', function (Blueprint $table) {
            $table->uuid('id')->default(DB::raw('(UUID())'));
            $table->uuid('vehicle_id');
            $table->uuid('transaction_id')->nullable();
            $table->string('state')->default('awaiting_report');
            $table->text('status_report')->nullable();
            $table->text('required_parts')->nullable();
            $table->decimal('estimated_cost', 12, 2)->nullable();
            $table->uuid('disbursement_id')->nullable();
            $table->text('final_report')->nullable();
            $table->decimal('actual_cost', 12, 2)->nullable();
            $table->uuid('mechanic_id')->nullable();
            $table->dateTime('papers_processed_at', 6)->nullable();
            $table->uuid('papers_processed_by')->nullable();
            $table->dateTime('completed_at', 6)->nullable();
            $table->dateTime('created_at', 6)->useCurrent();
            $table->bigInteger('refund_due_cents')->default(0);
            $table->dateTime('refunded_at', 6)->nullable();
            $table->uuid('uq_open_vehicle_id')->nullable()->virtualAs("IF(state <> 'completed', vehicle_id, NULL)")->invisible();
            $table->primary(['id']);
            $table->unique(['uq_open_vehicle_id'], 'reconditioning_jobs_one_open_per_vehicle');
        });

        Schema::create('reconditioning_parts', function (Blueprint $table) {
            $table->uuid('id')->default(DB::raw('(UUID())'));
            $table->uuid('job_id');
            $table->text('part_name');
            $table->text('replacement_brand');
            $table->bigInteger('estimated_cost_cents');
            $table->bigInteger('actual_cost_cents')->nullable();
            $table->dateTime('created_at', 6)->useCurrent();
            $table->dateTime('updated_at', 6)->useCurrent();
            $table->text('photo_path')->nullable();
            $table->primary(['id']);
        });

        Schema::create('repairs', function (Blueprint $table) {
            $table->uuid('id')->default(DB::raw('(UUID())'));
            $table->uuid('vehicle_id');
            $table->uuid('mechanic_id');
            $table->text('description');
            $table->string('status')->default('pending');
            $table->dateTime('started_at', 6)->nullable();
            $table->dateTime('completed_at', 6)->nullable();
            $table->text('notes')->nullable();
            $table->dateTime('created_at', 6)->useCurrent();
            $table->dateTime('updated_at', 6)->useCurrent();
            $table->primary(['id']);
        });

        Schema::create('reports', function (Blueprint $table) {
            $table->uuid('id')->default(DB::raw('(UUID())'));
            $table->string('report_kind');
            $table->text('title');
            $table->text('description')->nullable();
            $table->uuid('submitted_by');
            $table->text('evidence_storage_path')->nullable();
            $table->string('status')->default('draft');
            $table->date('period_start')->nullable();
            $table->date('period_end')->nullable();
            $table->dateTime('created_at', 6)->useCurrent();
            $table->dateTime('updated_at', 6)->useCurrent();
            $table->primary(['id']);
        });

        Schema::create('roadmap_items', function (Blueprint $table) {
            $table->uuid('id')->default(DB::raw('(UUID())'));
            $table->uuid('parent_id')->nullable();
            $table->string('kind');
            $table->text('title');
            $table->text('description')->nullable();
            $table->string('status')->default('planned');
            $table->string('priority')->default('medium');
            $table->string('quarter')->nullable();
            $table->integer('year')->nullable();
            $table->text('team')->nullable();
            $table->date('start_date')->nullable();
            $table->date('end_date')->nullable();
            $table->uuid('created_by')->nullable();
            $table->dateTime('created_at', 6)->useCurrent();
            $table->dateTime('updated_at', 6)->useCurrent();
            $table->primary(['id']);
        });

        Schema::create('sale_handovers', function (Blueprint $table) {
            $table->uuid('transaction_id');
            $table->string('papers_status')->nullable();
            $table->uuid('papers_ci_id')->nullable();
            $table->dateTime('papers_updated_at', 6)->nullable();
            $table->text('contract_body')->nullable();
            $table->string('contract_state')->nullable();
            $table->text('contract_returned_reason')->nullable();
            $table->uuid('contract_written_by')->nullable();
            $table->uuid('contract_approved_by')->nullable();
            $table->dateTime('contract_signed_at', 6)->nullable();
            $table->dateTime('ci_copy_at', 6)->nullable();
            $table->dateTime('mechanic_copy_at', 6)->nullable();
            $table->dateTime('signing_reported_at', 6)->nullable();
            $table->dateTime('buyer_met_at', 6)->nullable();
            $table->dateTime('cash_reported_at', 6)->nullable();
            $table->dateTime('created_at', 6)->useCurrent();
            $table->string('signing_method')->nullable();
            $table->text('signature_path')->nullable();
            $table->text('ci_signature_path')->nullable();
            $table->primary(['transaction_id']);
        });

        Schema::create('security_duty_checks', function (Blueprint $table) {
            $table->uuid('id')->default(DB::raw('(UUID())'));
            $table->uuid('security_id');
            $table->date('duty_date')->default(DB::raw('(CURRENT_DATE)'));
            $table->text('before_image_path')->nullable();
            $table->text('after_image_path')->nullable();
            $table->text('notes')->nullable();
            $table->string('status')->default('pending');
            $table->dateTime('completed_at', 6)->nullable();
            $table->dateTime('created_at', 6)->useCurrent();
            $table->dateTime('updated_at', 6)->useCurrent();
            $table->primary(['id']);
            $table->unique(['security_id', 'duty_date'], 'uq_security_duty_date');
        });

        Schema::create('sell_details', function (Blueprint $table) {
            $table->uuid('id')->default(DB::raw('(UUID())'));
            $table->uuid('transaction_id');
            $table->decimal('offered_amount', 12, 2)->nullable();
            $table->decimal('valuation_amount', 12, 2)->nullable();
            $table->text('review_notes')->nullable();
            $table->string('decision')->nullable();
            $table->uuid('decision_maker_id')->nullable();
            $table->dateTime('decision_date', 6)->nullable();
            $table->dateTime('created_at', 6)->useCurrent();
            $table->dateTime('updated_at', 6)->useCurrent();
            $table->json('condition_items')->default(DB::raw('(JSON_ARRAY())'));
            $table->boolean('has_known_issues')->nullable();
            $table->text('declared_issues')->nullable();
            $table->string('meetup_method')->nullable();
            $table->decimal('agreed_price', 12, 2)->nullable();
            $table->dateTime('cleared_for_payment_at', 6)->nullable();
            $table->smallInteger('owner_number')->nullable();
            $table->primary(['id']);
            $table->unique(['transaction_id'], 'sell_details_transaction_id_key');
        });

        Schema::create('transaction_documents', function (Blueprint $table) {
            $table->uuid('id')->default(DB::raw('(UUID())'));
            $table->uuid('transaction_id');
            $table->string('document_kind');
            $table->text('storage_path')->nullable();
            $table->uuid('uploader_id')->nullable();
            $table->string('verification_state')->default('pending');
            $table->uuid('verifier_id')->nullable();
            $table->dateTime('upload_date', 6)->useCurrent();
            $table->text('id_type')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->string('auto_check_status')->nullable();
            $table->text('auto_check_provider')->nullable();
            $table->text('auto_check_detail')->nullable();
            $table->dateTime('auto_checked_at', 6)->nullable();
            $table->string('id_side')->nullable();
            $table->text('note')->nullable();
            $table->primary(['id']);
        });

        Schema::create('transaction_status_history', function (Blueprint $table) {
            $table->uuid('id')->default(DB::raw('(UUID())'));
            $table->uuid('transaction_id');
            $table->string('from_state');
            $table->string('to_state');
            $table->uuid('actor_id');
            $table->text('reason')->nullable();
            $table->dateTime('changed_at', 6)->useCurrent();
            $table->primary(['id']);
        });

        Schema::create('transactions', function (Blueprint $table) {
            $table->uuid('id')->default(DB::raw('(UUID())'));
            $table->uuid('customer_id');
            $table->string('transaction_kind');
            $table->uuid('vehicle_id')->nullable();
            $table->string('current_state')->default('pending');
            $table->uuid('created_by');
            $table->dateTime('opened_at', 6)->useCurrent();
            $table->dateTime('completed_at', 6)->nullable();
            $table->dateTime('created_at', 6)->useCurrent();
            $table->dateTime('updated_at', 6)->useCurrent();
            $table->string('flow_status')->nullable();
            $table->string('flag')->nullable();
            $table->dateTime('review_due_at', 6)->nullable();
            $table->string('queue_state')->nullable();
            $table->uuid('uq_active_vehicle_id')->nullable()->virtualAs("IF(queue_state = 'active', vehicle_id, NULL)")->invisible();
            $table->primary(['id']);
            $table->unique(['uq_active_vehicle_id'], 'transactions_one_active_buyer_per_vehicle');
        });

        Schema::create('vehicle_document_items', function (Blueprint $table) {
            $table->uuid('id')->default(DB::raw('(UUID())'));
            $table->uuid('vehicle_id');
            $table->string('document_kind');
            $table->boolean('required_state')->default(true);
            $table->string('submitted_state')->default('required');
            $table->text('storage_path')->nullable();
            $table->uuid('checker_id')->nullable();
            $table->dateTime('checked_at', 6)->nullable();
            $table->dateTime('created_at', 6)->useCurrent();
            $table->primary(['id']);
            $table->unique(['vehicle_id', 'document_kind'], 'vehicle_document_items_vehicle_id_document_kind_key');
        });

        Schema::create('vehicle_inspections', function (Blueprint $table) {
            $table->uuid('id')->default(DB::raw('(UUID())'));
            $table->uuid('vehicle_id');
            $table->uuid('mechanic_id');
            $table->uuid('field_case_id')->nullable();
            $table->integer('condition_score')->nullable();
            $table->text('findings')->nullable();
            $table->text('recommendation')->nullable();
            $table->dateTime('inspection_date', 6)->useCurrent();
            $table->dateTime('created_at', 6)->useCurrent();
            $table->primary(['id']);
        });

        Schema::create('vehicle_media', function (Blueprint $table) {
            $table->uuid('id')->default(DB::raw('(UUID())'));
            $table->uuid('vehicle_id');
            $table->string('media_kind')->default('photo');
            $table->text('storage_path');
            $table->integer('display_order')->default(0);
            $table->boolean('public_state')->default(true);
            $table->uuid('uploaded_by')->nullable();
            $table->dateTime('uploaded_at', 6)->useCurrent();
            $table->primary(['id']);
        });

        Schema::create('vehicle_price_proposals', function (Blueprint $table) {
            $table->uuid('id')->default(DB::raw('(UUID())'));
            $table->uuid('vehicle_id');
            $table->decimal('proposed_amount', 12, 2);
            $table->uuid('proposer_id');
            $table->string('decision')->nullable();
            $table->uuid('decider_id')->nullable();
            $table->dateTime('decision_date', 6)->nullable();
            $table->text('notes')->nullable();
            $table->dateTime('created_at', 6)->useCurrent();
            $table->string('proposal_kind')->default('selling_price');
            $table->uuid('transaction_id')->nullable();
            $table->text('decision_notes')->nullable();
            $table->uuid('uq_pending_vehicle_id')->nullable()->virtualAs("IF(decision = 'pending', vehicle_id, NULL)")->invisible();
            $table->primary(['id']);
            $table->unique(['uq_pending_vehicle_id', 'proposal_kind'], 'vehicle_price_proposals_one_pending_per_kind');
        });

        Schema::create('vehicles', function (Blueprint $table) {
            $table->uuid('id')->default(DB::raw('(UUID())'));
            $table->string('stock_code');
            $table->string('vin')->nullable();
            $table->string('make');
            $table->string('model');
            $table->integer('year');
            $table->string('condition')->default('used');
            $table->integer('mileage')->nullable();
            $table->string('fuel_type')->nullable();
            $table->text('transmission')->nullable();
            $table->text('exterior_color')->nullable();
            $table->text('interior_color')->nullable();
            $table->text('body_type')->nullable();
            $table->text('engine')->nullable();
            $table->text('description')->nullable();
            $table->decimal('current_price', 12, 2)->nullable();
            $table->text('warranty_details')->nullable();
            $table->text('offer_details')->nullable();
            $table->string('listing_state')->default('draft');
            $table->dateTime('posted_at', 6)->nullable();
            $table->dateTime('created_at', 6)->useCurrent();
            $table->dateTime('updated_at', 6)->useCurrent();
            $table->text('purpose')->nullable();
            $table->text('plate_number')->nullable();
            $table->text('engine_number')->nullable();
            $table->text('chassis_number')->nullable();
            $table->decimal('financing_markup_pct', 5, 2)->nullable();
            $table->primary(['id']);
            $table->unique(['stock_code'], 'vehicles_stock_code_key');
            $table->unique(['vin'], 'vehicles_vin_key');
        });

        Schema::create('viewing_arrangements', function (Blueprint $table) {
            $table->uuid('id')->default(DB::raw('(UUID())'));
            $table->uuid('inquiry_id')->nullable();
            $table->uuid('purchase_transaction_id')->nullable();
            $table->string('arrangement_kind');
            $table->dateTime('schedule', 6);
            $table->text('location')->nullable();
            $table->decimal('down_payment_amount', 12, 2)->nullable();
            $table->string('confirmation_state')->default('pending');
            $table->uuid('confirmed_by')->nullable();
            $table->text('notes')->nullable();
            $table->dateTime('created_at', 6)->useCurrent();
            $table->uuid('vehicle_id');
            $table->uuid('uq_slot_vehicle_id')->nullable()->virtualAs("IF(confirmation_state IN ('pending', 'confirmed') AND arrangement_kind = 'gce_visit', vehicle_id, NULL)")->invisible();
            $table->primary(['id']);
            $table->unique(['uq_slot_vehicle_id', 'schedule'], 'viewing_arrangements_gce_visit_slot_lock');
        });

        DB::statement('CREATE INDEX idx_audit_events_actor ON audit_events (`actor_id`)');
        DB::statement('CREATE INDEX idx_audit_events_record ON audit_events (`record_kind`, `record_id`)');
        DB::statement('CREATE INDEX idx_audit_events_time ON audit_events (`created_at` DESC)');
        DB::statement('CREATE INDEX idx_collection_actions_installment ON collection_actions (`installment_id`)');
        DB::statement('CREATE INDEX idx_content_published ON content_items (`publication_state`, `content_kind`)');
        DB::statement('CREATE INDEX idx_customer_documents_customer ON customer_documents (`customer_id`)');
        DB::statement('CREATE INDEX customer_reviews_created_idx ON customer_reviews (`created_at` DESC)');
        DB::statement('CREATE INDEX customer_reviews_vehicle_idx ON customer_reviews (`vehicle_id`)');
        DB::statement('CREATE INDEX idx_employee_request_attachments_request ON employee_request_attachments (`request_id`)');
        DB::statement('CREATE INDEX idx_employee_requests_approved_leave_lookup ON employee_requests (employee_id, start_date, (COALESCE(end_date, start_date)))');
        DB::statement('CREATE INDEX idx_favourites_customer ON favourites (`customer_id`)');
        DB::statement('CREATE INDEX idx_field_case_expenses_case ON field_case_expenses (`field_case_id`)');
        DB::statement('CREATE INDEX idx_field_case_expenses_unreimbursed ON field_case_expenses (`field_case_id`)');
        DB::statement('CREATE INDEX idx_field_cases_informant ON field_cases (`assigned_confidential_informant`, `state`)');
        DB::statement('CREATE INDEX idx_field_cases_kind ON field_cases (`case_kind`, `state`)');
        DB::statement('CREATE INDEX idx_inquiries_account_manager ON inquiries (`assigned_account_manager`, `state`)');
        DB::statement('CREATE INDEX idx_inquiries_customer ON inquiries (`customer_id`)');
        DB::statement('CREATE INDEX idx_inquiries_sales_manager ON inquiries (`assigned_sales_manager`, `state`)');
        DB::statement('CREATE INDEX idx_inquiries_state ON inquiries (`state`)');
        DB::statement('CREATE UNIQUE INDEX idx_inquiries_transaction ON inquiries (transaction_id)');
        DB::statement('CREATE INDEX idx_messages_inquiry ON inquiry_messages (`inquiry_id`, `sent_at`)');
        DB::statement('CREATE INDEX idx_checklist_nodes_active ON inspection_checklist_nodes (`active`)');
        DB::statement('CREATE INDEX idx_checklist_nodes_parent ON inspection_checklist_nodes (`parent_id`, `display_order`)');
        DB::statement('CREATE INDEX idx_checklist_results_inspection ON inspection_checklist_results (`inspection_id`)');
        DB::statement('CREATE INDEX idx_issue_reports_transaction ON inspection_issue_reports (`transaction_id`)');
        DB::statement('CREATE INDEX idx_installments_state_due ON installments (`state`, `due_date`)');
        DB::statement('CREATE INDEX idx_attachments_message ON message_attachments (`message_id`)');
        DB::statement('CREATE INDEX idx_reports_state ON message_reports (`state`)');
        DB::statement('CREATE INDEX idx_notifications_recipient ON notifications (`recipient_role`, `is_read`)');
        DB::statement('CREATE INDEX idx_notifications_recipient_id ON notifications (`recipient_id`, `is_read`)');
        DB::statement('CREATE INDEX idx_notifications_reference ON notifications (`reference_table`, `reference_id`)');
        DB::statement('CREATE INDEX idx_part_replacements_answer ON part_replacements (`checklist_answer_id`)');
        DB::statement('CREATE INDEX idx_payment_records_date ON payment_records (`settlement_date`)');
        DB::statement('CREATE INDEX idx_payment_records_installment ON payment_records (`installment_id`)');
        DB::statement('CREATE INDEX idx_payment_records_installment_review ON payment_records (`transaction_id`, `installment_id`, `rejected_at`)');
        DB::statement('CREATE INDEX idx_payment_records_transaction ON payment_records (`transaction_id`)');
        DB::statement('CREATE INDEX payment_records_paymongo_checkout_id_idx ON payment_records (`paymongo_checkout_id`)');
        DB::statement('CREATE INDEX rbac_role_permissions_permission_id_idx ON rbac_role_permissions (`permission_id`)');
        DB::statement('CREATE INDEX idx_rec_feedback_run ON recommendation_feedback (`run_id`)');
        DB::statement('CREATE INDEX idx_rec_feedback_selected ON recommendation_feedback (`selected_vehicle_id`)');
        DB::statement('CREATE INDEX idx_rec_results_run ON recommendation_results (`run_id`, `rank`)');
        DB::statement('CREATE INDEX idx_rec_results_vehicle ON recommendation_results (`vehicle_id`)');
        DB::statement('CREATE INDEX idx_rec_runs_customer ON recommendation_runs (`customer_id`, `run_date` DESC)');
        DB::statement('CREATE INDEX idx_repairs_mechanic ON repairs (`mechanic_id`)');
        DB::statement('CREATE INDEX idx_repairs_status ON repairs (`status`)');
        DB::statement('CREATE INDEX idx_repairs_vehicle ON repairs (`vehicle_id`)');
        DB::statement('CREATE INDEX idx_roadmap_items_kind ON roadmap_items (`kind`)');
        DB::statement('CREATE INDEX idx_roadmap_items_parent ON roadmap_items (`parent_id`)');
        DB::statement('CREATE INDEX idx_roadmap_items_quarter ON roadmap_items (`quarter`, `year`)');
        DB::statement('CREATE INDEX idx_roadmap_items_status ON roadmap_items (`status`)');
        DB::statement('CREATE INDEX idx_transaction_docs ON transaction_documents (`transaction_id`, `document_kind`)');
        DB::statement('CREATE INDEX idx_status_history_transaction ON transaction_status_history (`transaction_id`, `changed_at`)');
        DB::statement('CREATE INDEX idx_transactions_customer ON transactions (`customer_id`, `opened_at` DESC)');
        DB::statement('CREATE INDEX idx_transactions_queue ON transactions (`transaction_kind`, `current_state`, `opened_at` DESC)');
        DB::statement('CREATE INDEX idx_transactions_review_due_at ON transactions (`review_due_at`)');
        DB::statement('CREATE INDEX idx_transactions_vehicle ON transactions (`vehicle_id`)');
        DB::statement('CREATE INDEX idx_vehicle_documents_pending ON vehicle_document_items (`vehicle_id`)');
        DB::statement('CREATE INDEX idx_vehicle_documents_vehicle ON vehicle_document_items (`vehicle_id`)');
        DB::statement('CREATE INDEX idx_inspections_mechanic ON vehicle_inspections (`mechanic_id`)');
        DB::statement('CREATE INDEX idx_inspections_vehicle ON vehicle_inspections (`vehicle_id`)');
        DB::statement('CREATE INDEX idx_vehicle_media_vehicle ON vehicle_media (`vehicle_id`, `display_order`)');
        DB::statement('CREATE INDEX idx_price_proposals_pending ON vehicle_price_proposals (`decision`)');
        DB::statement('CREATE INDEX idx_price_proposals_transaction ON vehicle_price_proposals (`transaction_id`)');
        DB::statement('CREATE INDEX idx_price_proposals_vehicle ON vehicle_price_proposals (`vehicle_id`)');
        DB::statement('CREATE INDEX idx_vehicles_available ON vehicles (`listing_state`)');
        DB::statement('CREATE INDEX idx_vehicles_fuel ON vehicles (`fuel_type`)');
        DB::statement('CREATE INDEX idx_vehicles_listing ON vehicles (`listing_state`, `make`, `model`, `year`, `current_price`)');
        DB::statement('CREATE INDEX idx_arrangements_inquiry ON viewing_arrangements (`inquiry_id`)');
    }

    public function down(): void
    {
        Schema::disableForeignKeyConstraints();
        Schema::dropIfExists('staff_compensation');
        Schema::dropIfExists('user_roles');
        Schema::dropIfExists('announcements');
        Schema::dropIfExists('app_settings');
        Schema::dropIfExists('attendance_entries');
        Schema::dropIfExists('audit_events');
        Schema::dropIfExists('collection_actions');
        Schema::dropIfExists('content_items');
        Schema::dropIfExists('customer_documents');
        Schema::dropIfExists('customer_reviews');
        Schema::dropIfExists('customer_standing');
        Schema::dropIfExists('disbursement_events');
        Schema::dropIfExists('disbursement_requests');
        Schema::dropIfExists('employee_request_attachments');
        Schema::dropIfExists('employee_requests');
        Schema::dropIfExists('employee_work_schedules');
        Schema::dropIfExists('favourites');
        Schema::dropIfExists('field_case_expenses');
        Schema::dropIfExists('field_cases');
        Schema::dropIfExists('financial_entries');
        Schema::dropIfExists('inquiries');
        Schema::dropIfExists('inquiry_messages');
        Schema::dropIfExists('inspection_checklist_nodes');
        Schema::dropIfExists('inspection_checklist_results');
        Schema::dropIfExists('inspection_issue_reports');
        Schema::dropIfExists('installment_accounts');
        Schema::dropIfExists('installments');
        Schema::dropIfExists('message_attachments');
        Schema::dropIfExists('message_reports');
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('part_replacements');
        Schema::dropIfExists('payment_records');
        Schema::dropIfExists('payment_reminders_sent');
        Schema::dropIfExists('payment_terms');
        Schema::dropIfExists('payroll_approvals');
        Schema::dropIfExists('payroll_runs');
        Schema::dropIfExists('payslip_items');
        Schema::dropIfExists('payslips');
        Schema::dropIfExists('performance_reviews');
        Schema::dropIfExists('profiles');
        Schema::dropIfExists('purchase_details');
        Schema::dropIfExists('rbac_access_areas');
        Schema::dropIfExists('rbac_actions');
        Schema::dropIfExists('rbac_permissions');
        Schema::dropIfExists('rbac_role_permissions');
        Schema::dropIfExists('rbac_roles');
        Schema::dropIfExists('recommendation_feedback');
        Schema::dropIfExists('recommendation_results');
        Schema::dropIfExists('recommendation_runs');
        Schema::dropIfExists('reconditioning_fund_receipts');
        Schema::dropIfExists('reconditioning_fund_requests');
        Schema::dropIfExists('reconditioning_jobs');
        Schema::dropIfExists('reconditioning_parts');
        Schema::dropIfExists('repairs');
        Schema::dropIfExists('reports');
        Schema::dropIfExists('roadmap_items');
        Schema::dropIfExists('sale_handovers');
        Schema::dropIfExists('security_duty_checks');
        Schema::dropIfExists('sell_details');
        Schema::dropIfExists('transaction_documents');
        Schema::dropIfExists('transaction_status_history');
        Schema::dropIfExists('transactions');
        Schema::dropIfExists('vehicle_document_items');
        Schema::dropIfExists('vehicle_inspections');
        Schema::dropIfExists('vehicle_media');
        Schema::dropIfExists('vehicle_price_proposals');
        Schema::dropIfExists('vehicles');
        Schema::dropIfExists('viewing_arrangements');
        Schema::enableForeignKeyConstraints();
    }
};
