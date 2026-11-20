<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const KINDS = "'valid_id', 'proof_of_billing', 'invoice', 'receipt', 'sale_document', 'sale_certificate', 'payment_receipt', 'sell_photo', 'orcr', 'official_receipt', 'certificate_of_registration', 'deed_of_sale', 'inspection_photo', 'expense_proof', 'issue_photo'";

    public function up(): void
    {
        $this->replaceConstraint(self::KINDS.", 'payslip'");
    }

    public function down(): void
    {
        $this->replaceConstraint(self::KINDS);
    }

    private function replaceConstraint(string $kinds): void
    {
        DB::statement('ALTER TABLE transaction_documents DROP CONSTRAINT transaction_documents_document_kind_check, '
            ."ADD CONSTRAINT transaction_documents_document_kind_check CHECK (document_kind IN ({$kinds}))");
    }
};
