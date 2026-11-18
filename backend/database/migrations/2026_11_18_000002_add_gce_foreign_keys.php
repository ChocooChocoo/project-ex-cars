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
        Schema::table('staff_compensation', function (Blueprint $table) {
            $table->foreign('created_by', 'staff_compensation_created_by_fkey')->references('id')->on('profiles');
            $table->foreign('employee_id', 'staff_compensation_employee_id_fkey')->references('id')->on('profiles')->cascadeOnDelete();
        });

        Schema::table('user_roles', function (Blueprint $table) {
            $table->foreign('account_id', 'user_roles_account_id_fkey')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('assigned_by', 'user_roles_assigned_by_fkey')->references('id')->on('users');
        });

        Schema::table('announcements', function (Blueprint $table) {
            $table->foreign('author_id', 'announcements_author_id_fkey')->references('id')->on('profiles');
        });

        Schema::table('app_settings', function (Blueprint $table) {
            $table->foreign('updated_by', 'app_settings_updated_by_fkey')->references('id')->on('users');
        });

        Schema::table('attendance_entries', function (Blueprint $table) {
            $table->foreign('checked_by', 'attendance_entries_checked_by_fkey')->references('id')->on('profiles');
            $table->foreign('employee_id', 'attendance_entries_employee_id_fkey')->references('id')->on('profiles')->cascadeOnDelete();
        });

        Schema::table('audit_events', function (Blueprint $table) {
            $table->foreign('actor_id', 'audit_events_actor_id_fkey')->references('id')->on('users');
        });

        Schema::table('collection_actions', function (Blueprint $table) {
            $table->foreign('actor_id', 'collection_actions_actor_id_fkey')->references('id')->on('users');
            $table->foreign('installment_id', 'collection_actions_installment_id_fkey')->references('id')->on('installments')->cascadeOnDelete();
        });

        Schema::table('content_items', function (Blueprint $table) {
            $table->foreign('author_id', 'content_items_author_id_fkey')->references('id')->on('users');
            $table->foreign('vehicle_id', 'content_items_vehicle_id_fkey')->references('id')->on('vehicles')->nullOnDelete();
        });

        Schema::table('customer_documents', function (Blueprint $table) {
            $table->foreign('customer_id', 'customer_documents_customer_id_fkey')->references('id')->on('profiles')->cascadeOnDelete();
            $table->foreign('verified_by', 'customer_documents_verified_by_fkey')->references('id')->on('users');
        });

        Schema::table('customer_reviews', function (Blueprint $table) {
            $table->foreign('customer_id', 'customer_reviews_customer_id_fkey')->references('id')->on('profiles');
            $table->foreign('transaction_id', 'customer_reviews_transaction_id_fkey')->references('id')->on('transactions')->cascadeOnDelete();
            $table->foreign('vehicle_id', 'customer_reviews_vehicle_id_fkey')->references('id')->on('vehicles');
        });

        Schema::table('customer_standing', function (Blueprint $table) {
            $table->foreign('account_id', 'customer_standing_account_id_fkey')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('updated_by', 'customer_standing_updated_by_fkey')->references('id')->on('users');
        });

        Schema::table('disbursement_events', function (Blueprint $table) {
            $table->foreign('actor_id', 'disbursement_events_actor_id_fkey')->references('id')->on('profiles');
            $table->foreign('disbursement_id', 'disbursement_events_disbursement_id_fkey')->references('id')->on('disbursement_requests')->cascadeOnDelete();
        });

        Schema::table('disbursement_requests', function (Blueprint $table) {
            $table->foreign('approved_by', 'disbursement_requests_approved_by_fkey')->references('id')->on('profiles');
            $table->foreign('field_case_id', 'disbursement_requests_field_case_id_fkey')->references('id')->on('field_cases');
            $table->foreign('purchase_transaction_id', 'disbursement_requests_purchase_transaction_id_fkey')->references('id')->on('transactions');
            $table->foreign('received_by', 'disbursement_requests_received_by_fkey')->references('id')->on('profiles');
            $table->foreign('released_by', 'disbursement_requests_released_by_fkey')->references('id')->on('profiles');
            $table->foreign('requested_by', 'disbursement_requests_requested_by_fkey')->references('id')->on('profiles');
            $table->foreign('return_confirmed_by', 'disbursement_requests_return_confirmed_by_fkey')->references('id')->on('profiles');
        });

        Schema::table('employee_request_attachments', function (Blueprint $table) {
            $table->foreign('request_id', 'employee_request_attachments_request_id_fkey')->references('id')->on('employee_requests')->cascadeOnDelete();
            $table->foreign('uploader_id', 'employee_request_attachments_uploader_id_fkey')->references('id')->on('users');
        });

        Schema::table('employee_requests', function (Blueprint $table) {
            $table->foreign('employee_id', 'employee_requests_employee_id_fkey')->references('id')->on('profiles')->cascadeOnDelete();
            $table->foreign('reviewed_by', 'employee_requests_reviewed_by_fkey')->references('id')->on('profiles');
        });

        Schema::table('employee_work_schedules', function (Blueprint $table) {
            $table->foreign('created_by', 'employee_work_schedules_created_by_fkey')->references('id')->on('profiles');
            $table->foreign('employee_id', 'employee_work_schedules_employee_id_fkey')->references('id')->on('profiles')->cascadeOnDelete();
            $table->foreign('updated_by', 'employee_work_schedules_updated_by_fkey')->references('id')->on('profiles');
        });

        Schema::table('favourites', function (Blueprint $table) {
            $table->foreign('customer_id', 'favourites_customer_id_fkey')->references('id')->on('profiles')->cascadeOnDelete();
            $table->foreign('vehicle_id', 'favourites_vehicle_id_fkey')->references('id')->on('vehicles')->cascadeOnDelete();
        });

        Schema::table('field_case_expenses', function (Blueprint $table) {
            $table->foreign('field_case_id', 'field_case_expenses_field_case_id_fkey')->references('id')->on('field_cases')->cascadeOnDelete();
            $table->foreign('proof_document_id', 'field_case_expenses_proof_document_id_fkey')->references('id')->on('transaction_documents');
            $table->foreign('reimbursed_by', 'field_case_expenses_reimbursed_by_fkey')->references('id')->on('users');
            $table->foreign('submitted_by', 'field_case_expenses_submitted_by_fkey')->references('id')->on('users');
        });

        Schema::table('field_cases', function (Blueprint $table) {
            $table->foreign('assigned_confidential_informant', 'field_cases_assigned_confidential_informant_fkey')->references('id')->on('users');
            $table->foreign('head_security_id', 'field_cases_head_security_id_fkey')->references('id')->on('users');
            $table->foreign('identity_confirmed_by', 'field_cases_identity_confirmed_by_fkey')->references('id')->on('users');
            $table->foreign('mechanic_id', 'field_cases_mechanic_id_fkey')->references('id')->on('users');
            $table->foreign('plate_confirmed_by', 'field_cases_plate_confirmed_by_fkey')->references('id')->on('users');
            $table->foreign('transaction_id', 'field_cases_transaction_id_fkey')->references('id')->on('transactions');
            $table->foreign('vehicle_id', 'field_cases_vehicle_id_fkey')->references('id')->on('vehicles');
        });

        Schema::table('financial_entries', function (Blueprint $table) {
            $table->foreign('field_case_id', 'financial_entries_field_case_id_fkey')->references('id')->on('field_cases')->nullOnDelete();
            $table->foreign('recorded_by', 'financial_entries_recorded_by_fkey')->references('id')->on('profiles');
            $table->foreign('transaction_id', 'financial_entries_transaction_id_fkey')->references('id')->on('transactions')->nullOnDelete();
            $table->foreign('verified_by', 'financial_entries_verified_by_fkey')->references('id')->on('profiles');
        });

        Schema::table('inquiries', function (Blueprint $table) {
            $table->foreign('assigned_account_manager', 'inquiries_assigned_account_manager_fkey')->references('id')->on('users');
            $table->foreign('assigned_sales_manager', 'inquiries_assigned_sales_manager_fkey')->references('id')->on('users');
            $table->foreign('customer_id', 'inquiries_customer_id_fkey')->references('id')->on('profiles')->cascadeOnDelete();
            $table->foreign('transaction_id', 'inquiries_transaction_id_fkey')->references('id')->on('transactions')->cascadeOnDelete();
            $table->foreign('vehicle_id', 'inquiries_vehicle_id_fkey')->references('id')->on('vehicles')->cascadeOnDelete();
        });

        Schema::table('inquiry_messages', function (Blueprint $table) {
            $table->foreign('inquiry_id', 'inquiry_messages_inquiry_id_fkey')->references('id')->on('inquiries')->cascadeOnDelete();
            $table->foreign('sender_id', 'inquiry_messages_sender_id_fkey')->references('id')->on('users');
        });

        Schema::table('inspection_checklist_nodes', function (Blueprint $table) {
            $table->foreign('parent_id', 'inspection_checklist_nodes_parent_id_fkey')->references('id')->on('inspection_checklist_nodes')->cascadeOnDelete();
        });

        Schema::table('inspection_checklist_results', function (Blueprint $table) {
            $table->foreign('checklist_entry_id', 'inspection_checklist_results_checklist_entry_id_fkey')->references('id')->on('inspection_checklist_nodes')->cascadeOnDelete();
            $table->foreign('inspection_id', 'inspection_checklist_results_inspection_id_fkey')->references('id')->on('vehicle_inspections')->cascadeOnDelete();
        });

        Schema::table('inspection_issue_reports', function (Blueprint $table) {
            $table->foreign('created_by', 'inspection_issue_reports_created_by_fkey')->references('id')->on('users');
            $table->foreign('field_case_id', 'inspection_issue_reports_field_case_id_fkey')->references('id')->on('field_cases')->cascadeOnDelete();
            $table->foreign('proposal_id', 'inspection_issue_reports_proposal_id_fkey')->references('id')->on('vehicle_price_proposals');
            $table->foreign('transaction_id', 'inspection_issue_reports_transaction_id_fkey')->references('id')->on('transactions')->cascadeOnDelete();
        });

        Schema::table('installment_accounts', function (Blueprint $table) {
            $table->foreign('purchase_transaction_id', 'installment_accounts_purchase_transaction_id_fkey')->references('id')->on('transactions');
        });

        Schema::table('installments', function (Blueprint $table) {
            $table->foreign('account_id', 'installments_account_id_fkey')->references('id')->on('installment_accounts')->cascadeOnDelete();
        });

        Schema::table('message_attachments', function (Blueprint $table) {
            $table->foreign('message_id', 'message_attachments_message_id_fkey')->references('id')->on('inquiry_messages')->cascadeOnDelete();
            $table->foreign('uploader_id', 'message_attachments_uploader_id_fkey')->references('id')->on('users');
        });

        Schema::table('message_reports', function (Blueprint $table) {
            $table->foreign('reported_inquiry_id', 'message_reports_reported_inquiry_id_fkey')->references('id')->on('inquiries')->nullOnDelete();
            $table->foreign('reported_message_id', 'message_reports_reported_message_id_fkey')->references('id')->on('inquiry_messages')->nullOnDelete();
            $table->foreign('reporter_id', 'message_reports_reporter_id_fkey')->references('id')->on('users');
            $table->foreign('reviewer_id', 'message_reports_reviewer_id_fkey')->references('id')->on('users');
        });

        Schema::table('notifications', function (Blueprint $table) {
            $table->foreign('recipient_id', 'notifications_recipient_id_fkey')->references('id')->on('users')->cascadeOnDelete();
        });

        Schema::table('part_replacements', function (Blueprint $table) {
            $table->foreign('checklist_answer_id', 'part_replacements_checklist_answer_id_fkey')->references('id')->on('inspection_checklist_results')->cascadeOnDelete();
        });

        Schema::table('payment_records', function (Blueprint $table) {
            $table->foreign('approved_by', 'payment_records_approved_by_fkey')->references('id')->on('users');
            $table->foreign('installment_id', 'payment_records_installment_id_fkey')->references('id')->on('installments');
            $table->foreign('recorded_by', 'payment_records_recorded_by_fkey')->references('id')->on('users');
            $table->foreign('rejected_by', 'payment_records_rejected_by_fkey')->references('id')->on('users');
            $table->foreign('submitted_by', 'payment_records_submitted_by_fkey')->references('id')->on('profiles');
            $table->foreign('transaction_id', 'payment_records_transaction_id_fkey')->references('id')->on('transactions');
            $table->foreign('verified_by', 'payment_records_verified_by_fkey')->references('id')->on('users');
        });

        Schema::table('payment_reminders_sent', function (Blueprint $table) {
            $table->foreign('installment_id', 'payment_reminders_sent_installment_id_fkey')->references('id')->on('installments')->cascadeOnDelete();
        });

        Schema::table('payment_terms', function (Blueprint $table) {
            $table->foreign('agreed_by', 'payment_terms_agreed_by_fkey')->references('id')->on('users');
            $table->foreign('approver_id', 'payment_terms_approver_id_fkey')->references('id')->on('users');
            $table->foreign('ha_reviewed_by', 'payment_terms_ha_reviewed_by_fkey')->references('id')->on('users');
            $table->foreign('purchase_transaction_id', 'payment_terms_purchase_transaction_id_fkey')->references('id')->on('transactions');
        });

        Schema::table('payroll_approvals', function (Blueprint $table) {
            $table->foreign('payroll_run_id', 'payroll_approvals_payroll_run_id_fkey')->references('id')->on('payroll_runs')->cascadeOnDelete();
            $table->foreign('reviewer_id', 'payroll_approvals_reviewer_id_fkey')->references('id')->on('profiles');
        });

        Schema::table('payroll_runs', function (Blueprint $table) {
            $table->foreign('prepared_by', 'payroll_runs_prepared_by_fkey')->references('id')->on('profiles');
        });

        Schema::table('payslip_items', function (Blueprint $table) {
            $table->foreign('payslip_id', 'payslip_items_payslip_id_fkey')->references('id')->on('payslips')->cascadeOnDelete();
        });

        Schema::table('payslips', function (Blueprint $table) {
            $table->foreign('employee_id', 'payslips_employee_id_fkey')->references('id')->on('profiles')->cascadeOnDelete();
            $table->foreign('paid_by', 'payslips_paid_by_fkey')->references('id')->on('profiles');
            $table->foreign('payroll_run_id', 'payslips_payroll_run_id_fkey')->references('id')->on('payroll_runs')->cascadeOnDelete();
        });

        Schema::table('performance_reviews', function (Blueprint $table) {
            $table->foreign('employee_id', 'performance_reviews_employee_id_fkey')->references('id')->on('profiles')->cascadeOnDelete();
            $table->foreign('reviewer_id', 'performance_reviews_reviewer_id_fkey')->references('id')->on('profiles');
        });

        Schema::table('profiles', function (Blueprint $table) {
            $table->foreign('created_by', 'profiles_created_by_fkey')->references('id')->on('users');
            $table->foreign('id', 'profiles_id_fkey')->references('id')->on('users')->cascadeOnDelete();
        });

        Schema::table('purchase_details', function (Blueprint $table) {
            $table->foreign('cancellation_towing_ack_by', 'purchase_details_cancellation_towing_ack_by_fkey')->references('id')->on('users');
            $table->foreign('checked_by', 'purchase_details_checked_by_fkey')->references('id')->on('users');
            $table->foreign('transaction_id', 'purchase_details_transaction_id_fkey')->references('id')->on('transactions')->cascadeOnDelete();
        });

        Schema::table('rbac_permissions', function (Blueprint $table) {
            $table->foreign('access_area_key', 'rbac_permissions_access_area_key_fkey')->references('key')->on('rbac_access_areas');
            $table->foreign('action_key', 'rbac_permissions_action_key_fkey')->references('key')->on('rbac_actions');
        });

        Schema::table('rbac_role_permissions', function (Blueprint $table) {
            $table->foreign('permission_id', 'rbac_role_permissions_permission_id_fkey')->references('id')->on('rbac_permissions')->restrictOnDelete();
            $table->foreign('role_key', 'rbac_role_permissions_role_key_fkey')->references('role_key')->on('rbac_roles')->restrictOnDelete();
        });

        Schema::table('recommendation_feedback', function (Blueprint $table) {
            $table->foreign('run_id', 'recommendation_feedback_run_id_fkey')->references('id')->on('recommendation_runs')->cascadeOnDelete();
            $table->foreign('selected_vehicle_id', 'recommendation_feedback_selected_vehicle_id_fkey')->references('id')->on('vehicles');
        });

        Schema::table('recommendation_results', function (Blueprint $table) {
            $table->foreign('run_id', 'recommendation_results_run_id_fkey')->references('id')->on('recommendation_runs')->cascadeOnDelete();
            $table->foreign('vehicle_id', 'recommendation_results_vehicle_id_fkey')->references('id')->on('vehicles')->cascadeOnDelete();
        });

        Schema::table('recommendation_runs', function (Blueprint $table) {
            $table->foreign('customer_id', 'recommendation_runs_customer_id_fkey')->references('id')->on('users');
        });

        Schema::table('reconditioning_fund_receipts', function (Blueprint $table) {
            $table->foreign('fund_request_id', 'reconditioning_fund_receipts_fund_request_id_fkey')->references('id')->on('reconditioning_fund_requests')->cascadeOnDelete();
            $table->foreign('uploaded_by', 'reconditioning_fund_receipts_uploaded_by_fkey')->references('id')->on('users');
        });

        Schema::table('reconditioning_fund_requests', function (Blueprint $table) {
            $table->foreign('created_by', 'reconditioning_fund_requests_created_by_fkey')->references('id')->on('users');
            $table->foreign('disbursement_id', 'reconditioning_fund_requests_disbursement_id_fkey')->references('id')->on('disbursement_requests');
            $table->foreign('job_id', 'reconditioning_fund_requests_job_id_fkey')->references('id')->on('reconditioning_jobs')->cascadeOnDelete();
        });

        Schema::table('reconditioning_jobs', function (Blueprint $table) {
            $table->foreign('disbursement_id', 'reconditioning_jobs_disbursement_id_fkey')->references('id')->on('disbursement_requests');
            $table->foreign('mechanic_id', 'reconditioning_jobs_mechanic_id_fkey')->references('id')->on('users');
            $table->foreign('papers_processed_by', 'reconditioning_jobs_papers_processed_by_fkey')->references('id')->on('users');
            $table->foreign('transaction_id', 'reconditioning_jobs_transaction_id_fkey')->references('id')->on('transactions');
            $table->foreign('vehicle_id', 'reconditioning_jobs_vehicle_id_fkey')->references('id')->on('vehicles')->cascadeOnDelete();
        });

        Schema::table('reconditioning_parts', function (Blueprint $table) {
            $table->foreign('job_id', 'reconditioning_parts_job_id_fkey')->references('id')->on('reconditioning_jobs')->cascadeOnDelete();
        });

        Schema::table('repairs', function (Blueprint $table) {
            $table->foreign('mechanic_id', 'repairs_mechanic_id_fkey')->references('id')->on('users');
            $table->foreign('vehicle_id', 'repairs_vehicle_id_fkey')->references('id')->on('vehicles')->cascadeOnDelete();
        });

        Schema::table('reports', function (Blueprint $table) {
            $table->foreign('submitted_by', 'reports_submitted_by_fkey')->references('id')->on('profiles');
        });

        Schema::table('roadmap_items', function (Blueprint $table) {
            $table->foreign('created_by', 'roadmap_items_created_by_fkey')->references('id')->on('profiles');
            $table->foreign('parent_id', 'roadmap_items_parent_id_fkey')->references('id')->on('roadmap_items')->cascadeOnDelete();
        });

        Schema::table('sale_handovers', function (Blueprint $table) {
            $table->foreign('contract_approved_by', 'sale_handovers_contract_approved_by_fkey')->references('id')->on('users');
            $table->foreign('contract_written_by', 'sale_handovers_contract_written_by_fkey')->references('id')->on('users');
            $table->foreign('papers_ci_id', 'sale_handovers_papers_ci_id_fkey')->references('id')->on('users');
            $table->foreign('transaction_id', 'sale_handovers_transaction_id_fkey')->references('id')->on('transactions')->cascadeOnDelete();
        });

        Schema::table('security_duty_checks', function (Blueprint $table) {
            $table->foreign('security_id', 'security_duty_checks_security_id_fkey')->references('id')->on('profiles')->cascadeOnDelete();
        });

        Schema::table('sell_details', function (Blueprint $table) {
            $table->foreign('decision_maker_id', 'sell_details_decision_maker_id_fkey')->references('id')->on('users');
            $table->foreign('transaction_id', 'sell_details_transaction_id_fkey')->references('id')->on('transactions')->cascadeOnDelete();
        });

        Schema::table('transaction_documents', function (Blueprint $table) {
            $table->foreign('transaction_id', 'transaction_documents_transaction_id_fkey')->references('id')->on('transactions')->cascadeOnDelete();
            $table->foreign('uploader_id', 'transaction_documents_uploader_id_fkey')->references('id')->on('users');
            $table->foreign('verifier_id', 'transaction_documents_verifier_id_fkey')->references('id')->on('users');
        });

        Schema::table('transaction_status_history', function (Blueprint $table) {
            $table->foreign('actor_id', 'transaction_status_history_actor_id_fkey')->references('id')->on('users');
            $table->foreign('transaction_id', 'transaction_status_history_transaction_id_fkey')->references('id')->on('transactions')->cascadeOnDelete();
        });

        Schema::table('transactions', function (Blueprint $table) {
            $table->foreign('created_by', 'transactions_created_by_fkey')->references('id')->on('users');
            $table->foreign('customer_id', 'transactions_customer_id_fkey')->references('id')->on('profiles');
            $table->foreign('vehicle_id', 'transactions_vehicle_id_fkey')->references('id')->on('vehicles');
        });

        Schema::table('vehicle_document_items', function (Blueprint $table) {
            $table->foreign('checker_id', 'vehicle_document_items_checker_id_fkey')->references('id')->on('users');
            $table->foreign('vehicle_id', 'vehicle_document_items_vehicle_id_fkey')->references('id')->on('vehicles')->cascadeOnDelete();
        });

        Schema::table('vehicle_inspections', function (Blueprint $table) {
            $table->foreign('mechanic_id', 'vehicle_inspections_mechanic_id_fkey')->references('id')->on('users');
            $table->foreign('vehicle_id', 'vehicle_inspections_vehicle_id_fkey')->references('id')->on('vehicles')->cascadeOnDelete();
        });

        Schema::table('vehicle_media', function (Blueprint $table) {
            $table->foreign('uploaded_by', 'vehicle_media_uploaded_by_fkey')->references('id')->on('users');
            $table->foreign('vehicle_id', 'vehicle_media_vehicle_id_fkey')->references('id')->on('vehicles')->cascadeOnDelete();
        });

        Schema::table('vehicle_price_proposals', function (Blueprint $table) {
            $table->foreign('decider_id', 'vehicle_price_proposals_decider_id_fkey')->references('id')->on('users');
            $table->foreign('proposer_id', 'vehicle_price_proposals_proposer_id_fkey')->references('id')->on('users');
            $table->foreign('transaction_id', 'vehicle_price_proposals_transaction_id_fkey')->references('id')->on('transactions')->cascadeOnDelete();
            $table->foreign('vehicle_id', 'vehicle_price_proposals_vehicle_id_fkey')->references('id')->on('vehicles')->cascadeOnDelete();
        });

        Schema::table('viewing_arrangements', function (Blueprint $table) {
            $table->foreign('purchase_transaction_id', 'fk_arrangements_transaction')->references('id')->on('transactions');
            $table->foreign('confirmed_by', 'viewing_arrangements_confirmed_by_fkey')->references('id')->on('users');
            $table->foreign('inquiry_id', 'viewing_arrangements_inquiry_id_fkey')->references('id')->on('inquiries')->cascadeOnDelete();
            $table->foreign('vehicle_id', 'viewing_arrangements_vehicle_id_fkey')->references('id')->on('vehicles')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('staff_compensation', function (Blueprint $table) {
            $table->dropForeign('staff_compensation_created_by_fkey');
            $table->dropForeign('staff_compensation_employee_id_fkey');
        });
        Schema::table('user_roles', function (Blueprint $table) {
            $table->dropForeign('user_roles_account_id_fkey');
            $table->dropForeign('user_roles_assigned_by_fkey');
        });
        Schema::table('announcements', function (Blueprint $table) {
            $table->dropForeign('announcements_author_id_fkey');
        });
        Schema::table('app_settings', function (Blueprint $table) {
            $table->dropForeign('app_settings_updated_by_fkey');
        });
        Schema::table('attendance_entries', function (Blueprint $table) {
            $table->dropForeign('attendance_entries_checked_by_fkey');
            $table->dropForeign('attendance_entries_employee_id_fkey');
        });
        Schema::table('audit_events', function (Blueprint $table) {
            $table->dropForeign('audit_events_actor_id_fkey');
        });
        Schema::table('collection_actions', function (Blueprint $table) {
            $table->dropForeign('collection_actions_actor_id_fkey');
            $table->dropForeign('collection_actions_installment_id_fkey');
        });
        Schema::table('content_items', function (Blueprint $table) {
            $table->dropForeign('content_items_author_id_fkey');
            $table->dropForeign('content_items_vehicle_id_fkey');
        });
        Schema::table('customer_documents', function (Blueprint $table) {
            $table->dropForeign('customer_documents_customer_id_fkey');
            $table->dropForeign('customer_documents_verified_by_fkey');
        });
        Schema::table('customer_reviews', function (Blueprint $table) {
            $table->dropForeign('customer_reviews_customer_id_fkey');
            $table->dropForeign('customer_reviews_transaction_id_fkey');
            $table->dropForeign('customer_reviews_vehicle_id_fkey');
        });
        Schema::table('customer_standing', function (Blueprint $table) {
            $table->dropForeign('customer_standing_account_id_fkey');
            $table->dropForeign('customer_standing_updated_by_fkey');
        });
        Schema::table('disbursement_events', function (Blueprint $table) {
            $table->dropForeign('disbursement_events_actor_id_fkey');
            $table->dropForeign('disbursement_events_disbursement_id_fkey');
        });
        Schema::table('disbursement_requests', function (Blueprint $table) {
            $table->dropForeign('disbursement_requests_approved_by_fkey');
            $table->dropForeign('disbursement_requests_field_case_id_fkey');
            $table->dropForeign('disbursement_requests_purchase_transaction_id_fkey');
            $table->dropForeign('disbursement_requests_received_by_fkey');
            $table->dropForeign('disbursement_requests_released_by_fkey');
            $table->dropForeign('disbursement_requests_requested_by_fkey');
            $table->dropForeign('disbursement_requests_return_confirmed_by_fkey');
        });
        Schema::table('employee_request_attachments', function (Blueprint $table) {
            $table->dropForeign('employee_request_attachments_request_id_fkey');
            $table->dropForeign('employee_request_attachments_uploader_id_fkey');
        });
        Schema::table('employee_requests', function (Blueprint $table) {
            $table->dropForeign('employee_requests_employee_id_fkey');
            $table->dropForeign('employee_requests_reviewed_by_fkey');
        });
        Schema::table('employee_work_schedules', function (Blueprint $table) {
            $table->dropForeign('employee_work_schedules_created_by_fkey');
            $table->dropForeign('employee_work_schedules_employee_id_fkey');
            $table->dropForeign('employee_work_schedules_updated_by_fkey');
        });
        Schema::table('favourites', function (Blueprint $table) {
            $table->dropForeign('favourites_customer_id_fkey');
            $table->dropForeign('favourites_vehicle_id_fkey');
        });
        Schema::table('field_case_expenses', function (Blueprint $table) {
            $table->dropForeign('field_case_expenses_field_case_id_fkey');
            $table->dropForeign('field_case_expenses_proof_document_id_fkey');
            $table->dropForeign('field_case_expenses_reimbursed_by_fkey');
            $table->dropForeign('field_case_expenses_submitted_by_fkey');
        });
        Schema::table('field_cases', function (Blueprint $table) {
            $table->dropForeign('field_cases_assigned_confidential_informant_fkey');
            $table->dropForeign('field_cases_head_security_id_fkey');
            $table->dropForeign('field_cases_identity_confirmed_by_fkey');
            $table->dropForeign('field_cases_mechanic_id_fkey');
            $table->dropForeign('field_cases_plate_confirmed_by_fkey');
            $table->dropForeign('field_cases_transaction_id_fkey');
            $table->dropForeign('field_cases_vehicle_id_fkey');
        });
        Schema::table('financial_entries', function (Blueprint $table) {
            $table->dropForeign('financial_entries_field_case_id_fkey');
            $table->dropForeign('financial_entries_recorded_by_fkey');
            $table->dropForeign('financial_entries_transaction_id_fkey');
            $table->dropForeign('financial_entries_verified_by_fkey');
        });
        Schema::table('inquiries', function (Blueprint $table) {
            $table->dropForeign('inquiries_assigned_account_manager_fkey');
            $table->dropForeign('inquiries_assigned_sales_manager_fkey');
            $table->dropForeign('inquiries_customer_id_fkey');
            $table->dropForeign('inquiries_transaction_id_fkey');
            $table->dropForeign('inquiries_vehicle_id_fkey');
        });
        Schema::table('inquiry_messages', function (Blueprint $table) {
            $table->dropForeign('inquiry_messages_inquiry_id_fkey');
            $table->dropForeign('inquiry_messages_sender_id_fkey');
        });
        Schema::table('inspection_checklist_nodes', function (Blueprint $table) {
            $table->dropForeign('inspection_checklist_nodes_parent_id_fkey');
        });
        Schema::table('inspection_checklist_results', function (Blueprint $table) {
            $table->dropForeign('inspection_checklist_results_checklist_entry_id_fkey');
            $table->dropForeign('inspection_checklist_results_inspection_id_fkey');
        });
        Schema::table('inspection_issue_reports', function (Blueprint $table) {
            $table->dropForeign('inspection_issue_reports_created_by_fkey');
            $table->dropForeign('inspection_issue_reports_field_case_id_fkey');
            $table->dropForeign('inspection_issue_reports_proposal_id_fkey');
            $table->dropForeign('inspection_issue_reports_transaction_id_fkey');
        });
        Schema::table('installment_accounts', function (Blueprint $table) {
            $table->dropForeign('installment_accounts_purchase_transaction_id_fkey');
        });
        Schema::table('installments', function (Blueprint $table) {
            $table->dropForeign('installments_account_id_fkey');
        });
        Schema::table('message_attachments', function (Blueprint $table) {
            $table->dropForeign('message_attachments_message_id_fkey');
            $table->dropForeign('message_attachments_uploader_id_fkey');
        });
        Schema::table('message_reports', function (Blueprint $table) {
            $table->dropForeign('message_reports_reported_inquiry_id_fkey');
            $table->dropForeign('message_reports_reported_message_id_fkey');
            $table->dropForeign('message_reports_reporter_id_fkey');
            $table->dropForeign('message_reports_reviewer_id_fkey');
        });
        Schema::table('notifications', function (Blueprint $table) {
            $table->dropForeign('notifications_recipient_id_fkey');
        });
        Schema::table('part_replacements', function (Blueprint $table) {
            $table->dropForeign('part_replacements_checklist_answer_id_fkey');
        });
        Schema::table('payment_records', function (Blueprint $table) {
            $table->dropForeign('payment_records_approved_by_fkey');
            $table->dropForeign('payment_records_installment_id_fkey');
            $table->dropForeign('payment_records_recorded_by_fkey');
            $table->dropForeign('payment_records_rejected_by_fkey');
            $table->dropForeign('payment_records_submitted_by_fkey');
            $table->dropForeign('payment_records_transaction_id_fkey');
            $table->dropForeign('payment_records_verified_by_fkey');
        });
        Schema::table('payment_reminders_sent', function (Blueprint $table) {
            $table->dropForeign('payment_reminders_sent_installment_id_fkey');
        });
        Schema::table('payment_terms', function (Blueprint $table) {
            $table->dropForeign('payment_terms_agreed_by_fkey');
            $table->dropForeign('payment_terms_approver_id_fkey');
            $table->dropForeign('payment_terms_ha_reviewed_by_fkey');
            $table->dropForeign('payment_terms_purchase_transaction_id_fkey');
        });
        Schema::table('payroll_approvals', function (Blueprint $table) {
            $table->dropForeign('payroll_approvals_payroll_run_id_fkey');
            $table->dropForeign('payroll_approvals_reviewer_id_fkey');
        });
        Schema::table('payroll_runs', function (Blueprint $table) {
            $table->dropForeign('payroll_runs_prepared_by_fkey');
        });
        Schema::table('payslip_items', function (Blueprint $table) {
            $table->dropForeign('payslip_items_payslip_id_fkey');
        });
        Schema::table('payslips', function (Blueprint $table) {
            $table->dropForeign('payslips_employee_id_fkey');
            $table->dropForeign('payslips_paid_by_fkey');
            $table->dropForeign('payslips_payroll_run_id_fkey');
        });
        Schema::table('performance_reviews', function (Blueprint $table) {
            $table->dropForeign('performance_reviews_employee_id_fkey');
            $table->dropForeign('performance_reviews_reviewer_id_fkey');
        });
        Schema::table('profiles', function (Blueprint $table) {
            $table->dropForeign('profiles_created_by_fkey');
            $table->dropForeign('profiles_id_fkey');
        });
        Schema::table('purchase_details', function (Blueprint $table) {
            $table->dropForeign('purchase_details_cancellation_towing_ack_by_fkey');
            $table->dropForeign('purchase_details_checked_by_fkey');
            $table->dropForeign('purchase_details_transaction_id_fkey');
        });
        Schema::table('rbac_permissions', function (Blueprint $table) {
            $table->dropForeign('rbac_permissions_access_area_key_fkey');
            $table->dropForeign('rbac_permissions_action_key_fkey');
        });
        Schema::table('rbac_role_permissions', function (Blueprint $table) {
            $table->dropForeign('rbac_role_permissions_permission_id_fkey');
            $table->dropForeign('rbac_role_permissions_role_key_fkey');
        });
        Schema::table('recommendation_feedback', function (Blueprint $table) {
            $table->dropForeign('recommendation_feedback_run_id_fkey');
            $table->dropForeign('recommendation_feedback_selected_vehicle_id_fkey');
        });
        Schema::table('recommendation_results', function (Blueprint $table) {
            $table->dropForeign('recommendation_results_run_id_fkey');
            $table->dropForeign('recommendation_results_vehicle_id_fkey');
        });
        Schema::table('recommendation_runs', function (Blueprint $table) {
            $table->dropForeign('recommendation_runs_customer_id_fkey');
        });
        Schema::table('reconditioning_fund_receipts', function (Blueprint $table) {
            $table->dropForeign('reconditioning_fund_receipts_fund_request_id_fkey');
            $table->dropForeign('reconditioning_fund_receipts_uploaded_by_fkey');
        });
        Schema::table('reconditioning_fund_requests', function (Blueprint $table) {
            $table->dropForeign('reconditioning_fund_requests_created_by_fkey');
            $table->dropForeign('reconditioning_fund_requests_disbursement_id_fkey');
            $table->dropForeign('reconditioning_fund_requests_job_id_fkey');
        });
        Schema::table('reconditioning_jobs', function (Blueprint $table) {
            $table->dropForeign('reconditioning_jobs_disbursement_id_fkey');
            $table->dropForeign('reconditioning_jobs_mechanic_id_fkey');
            $table->dropForeign('reconditioning_jobs_papers_processed_by_fkey');
            $table->dropForeign('reconditioning_jobs_transaction_id_fkey');
            $table->dropForeign('reconditioning_jobs_vehicle_id_fkey');
        });
        Schema::table('reconditioning_parts', function (Blueprint $table) {
            $table->dropForeign('reconditioning_parts_job_id_fkey');
        });
        Schema::table('repairs', function (Blueprint $table) {
            $table->dropForeign('repairs_mechanic_id_fkey');
            $table->dropForeign('repairs_vehicle_id_fkey');
        });
        Schema::table('reports', function (Blueprint $table) {
            $table->dropForeign('reports_submitted_by_fkey');
        });
        Schema::table('roadmap_items', function (Blueprint $table) {
            $table->dropForeign('roadmap_items_created_by_fkey');
            $table->dropForeign('roadmap_items_parent_id_fkey');
        });
        Schema::table('sale_handovers', function (Blueprint $table) {
            $table->dropForeign('sale_handovers_contract_approved_by_fkey');
            $table->dropForeign('sale_handovers_contract_written_by_fkey');
            $table->dropForeign('sale_handovers_papers_ci_id_fkey');
            $table->dropForeign('sale_handovers_transaction_id_fkey');
        });
        Schema::table('security_duty_checks', function (Blueprint $table) {
            $table->dropForeign('security_duty_checks_security_id_fkey');
        });
        Schema::table('sell_details', function (Blueprint $table) {
            $table->dropForeign('sell_details_decision_maker_id_fkey');
            $table->dropForeign('sell_details_transaction_id_fkey');
        });
        Schema::table('transaction_documents', function (Blueprint $table) {
            $table->dropForeign('transaction_documents_transaction_id_fkey');
            $table->dropForeign('transaction_documents_uploader_id_fkey');
            $table->dropForeign('transaction_documents_verifier_id_fkey');
        });
        Schema::table('transaction_status_history', function (Blueprint $table) {
            $table->dropForeign('transaction_status_history_actor_id_fkey');
            $table->dropForeign('transaction_status_history_transaction_id_fkey');
        });
        Schema::table('transactions', function (Blueprint $table) {
            $table->dropForeign('transactions_created_by_fkey');
            $table->dropForeign('transactions_customer_id_fkey');
            $table->dropForeign('transactions_vehicle_id_fkey');
        });
        Schema::table('vehicle_document_items', function (Blueprint $table) {
            $table->dropForeign('vehicle_document_items_checker_id_fkey');
            $table->dropForeign('vehicle_document_items_vehicle_id_fkey');
        });
        Schema::table('vehicle_inspections', function (Blueprint $table) {
            $table->dropForeign('vehicle_inspections_mechanic_id_fkey');
            $table->dropForeign('vehicle_inspections_vehicle_id_fkey');
        });
        Schema::table('vehicle_media', function (Blueprint $table) {
            $table->dropForeign('vehicle_media_uploaded_by_fkey');
            $table->dropForeign('vehicle_media_vehicle_id_fkey');
        });
        Schema::table('vehicle_price_proposals', function (Blueprint $table) {
            $table->dropForeign('vehicle_price_proposals_decider_id_fkey');
            $table->dropForeign('vehicle_price_proposals_proposer_id_fkey');
            $table->dropForeign('vehicle_price_proposals_transaction_id_fkey');
            $table->dropForeign('vehicle_price_proposals_vehicle_id_fkey');
        });
        Schema::table('viewing_arrangements', function (Blueprint $table) {
            $table->dropForeign('fk_arrangements_transaction');
            $table->dropForeign('viewing_arrangements_confirmed_by_fkey');
            $table->dropForeign('viewing_arrangements_inquiry_id_fkey');
            $table->dropForeign('viewing_arrangements_vehicle_id_fkey');
        });
    }
};
