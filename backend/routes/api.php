<?php

use App\Enums\Role;
use App\Http\Controllers\AccountAdminController;
use App\Http\Controllers\Auth\PasswordResetController;
use App\Http\Controllers\Auth\RegistrationController;
use App\Http\Controllers\Auth\SessionController;
use App\Http\Controllers\Catalogue\ContentController;
use App\Http\Controllers\Catalogue\FavouriteController;
use App\Http\Controllers\Catalogue\InspectionController;
use App\Http\Controllers\Catalogue\RecommendationController;
use App\Http\Controllers\Catalogue\ShowroomController;
use App\Http\Controllers\Catalogue\StaffVehicleController;
use App\Http\Controllers\Field\FieldCaseActionController;
use App\Http\Controllers\Field\FieldReadController;
use App\Http\Controllers\FileController;
use App\Http\Controllers\Finance\CheckoutController;
use App\Http\Controllers\Finance\FieldBudgetController;
use App\Http\Controllers\Finance\FinanceController;
use App\Http\Controllers\Finance\FinanceReadController;
use App\Http\Controllers\Finance\FinancingTermsController;
use App\Http\Controllers\Finance\PaymentController;
use App\Http\Controllers\Finance\PayMongoWebhookController;
use App\Http\Controllers\MeController;
use App\Http\Controllers\Messaging\InquiryController;
use App\Http\Controllers\Messaging\InquiryWorkflowController;
use App\Http\Controllers\Messaging\NotificationController;
use App\Http\Controllers\Staff\AdminController;
use App\Http\Controllers\Staff\AnnouncementController;
use App\Http\Controllers\Staff\AttendanceController;
use App\Http\Controllers\Staff\DashboardController;
use App\Http\Controllers\Staff\EmployeeRequestController;
use App\Http\Controllers\Staff\PayrollController;
use App\Http\Controllers\Staff\ReportController;
use App\Http\Controllers\Staff\RoadmapController;
use App\Http\Controllers\Staff\SecurityDutyController;
use App\Http\Controllers\Staff\StaffRecordController;
use App\Http\Controllers\Supplier\SupplierController;
use App\Http\Controllers\ThumbnailController;
use App\Http\Controllers\Trading\CustomerTradingController;
use App\Http\Controllers\Trading\CustomerTradingReadController;
use App\Http\Controllers\Trading\DeliveryController;
use App\Http\Controllers\Trading\FinancingVisitController;
use App\Http\Controllers\Trading\HandoverController;
use App\Http\Controllers\Trading\PapersReadController;
use App\Http\Controllers\Trading\ReconditioningController;
use App\Http\Controllers\Trading\SellFlowController;
use App\Http\Controllers\Trading\SellIntakeController;
use App\Http\Controllers\Trading\SellPapersController;
use App\Http\Controllers\Trading\StaffTradingReadController;
use App\Http\Controllers\Trading\StaffTransactionController;
use App\Http\Controllers\Trading\VehicleWriteController;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;

// Browser and Next.js server adapters call these with Sanctum first-party cookies (no bearer tokens).
Route::prefix('v1')->group(function () {
    Route::prefix('auth')->group(function () {
        Route::post('login', [SessionController::class, 'store'])->middleware('throttle:login');
        Route::post('logout', [SessionController::class, 'destroy']);
        Route::post('register', [RegistrationController::class, 'store'])->middleware('throttle:auth-email');
        Route::post('register-supplier', [SupplierController::class, 'register'])->middleware('throttle:auth-email');
        Route::post('email/resend', [RegistrationController::class, 'resend'])->middleware('throttle:auth-email');
        Route::get('email/verify/{id}/{hash}', [RegistrationController::class, 'verify'])
            ->middleware(['signed:relative', 'throttle:6,1,email-verify'])->name('verification.verify');
        Route::get('email/change/{id}', [RegistrationController::class, 'confirmEmailChange'])
            ->middleware(['signed:relative', 'throttle:6,1,email-change-confirm'])->name('email.change.confirm');
        Route::post('password/forgot', [PasswordResetController::class, 'sendLink'])->middleware('throttle:auth-email');
        Route::post('password/reset', [PasswordResetController::class, 'reset'])->middleware('throttle:login');
    });

    // Public reads (landing page) and signed private-file links: the signature is the credential.
    Route::get('catalogue/landing', [ShowroomController::class, 'landing'])->middleware('throttle:60,1,catalogue-landing');
    Route::get('files/{bucket}/{path}', [FileController::class, 'show'])->where('path', '.*')
        ->middleware('signed:relative')->name('files.show');
    Route::get('thumbnail', [ThumbnailController::class, 'show'])->middleware('throttle:120,1,thumbnail');

    // PayMongo's webhook (Phase 6): no session; the HMAC signature over the raw body is the credential.
    Route::post('paymongo/webhook', PayMongoWebhookController::class)->middleware('throttle:120,1,paymongo-webhook');

    Route::middleware(['auth:sanctum', 'active'])->group(function () {
        Route::get('me', [MeController::class, 'show']);
        Route::patch('me/profile', [MeController::class, 'updateProfile']);
        Route::put('me/password', [MeController::class, 'updatePassword'])->middleware('throttle:login');
        Route::post('me/email', [MeController::class, 'requestEmailChange'])->middleware(['role:customer', 'throttle:auth-email']);
        Route::post('me/tutorial', [MeController::class, 'completeTutorial']);
        Route::post('me/avatar', [MeController::class, 'updateAvatar'])->middleware('throttle:20,1,avatar');
        Route::delete('me/avatar', [MeController::class, 'removeAvatar']);

        // Catalogue (Phase 4).
        Route::get('catalogue/vehicles', [ShowroomController::class, 'index']);
        Route::get('catalogue/vehicles/{id}', [ShowroomController::class, 'show']);
        Route::get('favourites', [FavouriteController::class, 'index']);
        Route::post('favourites/{vehicleId}', [FavouriteController::class, 'toggle']);
        Route::get('recommendations', [RecommendationController::class, 'index']);
        Route::post('recommendations', [RecommendationController::class, 'store'])->middleware('throttle:20,1,recommendations');
        Route::get('recommendations/{runId}', [RecommendationController::class, 'show']);
        Route::post('recommendations/{runId}/feedback', [RecommendationController::class, 'feedback']);

        // Inquiries, messages and notifications (Phase 4). Browsers poll the `?after=` endpoints.
        Route::get('inquiries', [InquiryController::class, 'index']);
        Route::get('inquiries/unread-count', [InquiryController::class, 'unreadTotal']);
        Route::get('inquiries/{id}', [InquiryController::class, 'show']);
        Route::get('inquiries/{id}/messages', [InquiryController::class, 'messages'])->middleware('throttle:polling');
        Route::post('inquiries/{id}/messages', [InquiryController::class, 'storeMessage'])->middleware('throttle:30,1,inquiry-messages');
        Route::post('inquiries/{id}/read', [InquiryController::class, 'markRead']);
        Route::post('inquiries/{id}/reports', [InquiryController::class, 'report'])->middleware('throttle:10,1,inquiry-reports');
        Route::get('staff/message-reports', [InquiryController::class, 'reports'])->middleware('role:ceo,account_manager');
        Route::get('notifications', [NotificationController::class, 'index'])->middleware('throttle:polling');
        Route::get('notifications/count', [NotificationController::class, 'count']);
        Route::post('notifications/read-all', [NotificationController::class, 'markAll']);
        Route::post('notifications/{id}/read', [NotificationController::class, 'markRead']);

        Route::middleware('role:ceo,account_manager,head_accountant,confidential_informant,marketing_specialist,mechanic,sales_manager,head_security')->prefix('staff')->group(function () {
            Route::get('vehicles', [StaffVehicleController::class, 'index']);
            Route::get('vehicles/{id}', [StaffVehicleController::class, 'show']);
        });
        Route::middleware('role:marketing_specialist')->prefix('staff')->group(function () {
            Route::post('vehicles/{id}/media', [StaffVehicleController::class, 'storeMedia']);
            Route::delete('vehicle-media/{mediaId}', [StaffVehicleController::class, 'destroyMedia']);
            Route::post('content', [ContentController::class, 'store']);
            Route::patch('content/{id}', [ContentController::class, 'update']);
            Route::post('content/{id}/publish', [ContentController::class, 'publish']);
            Route::delete('content/{id}', [ContentController::class, 'destroy']);
        });
        Route::get('staff/content', [ContentController::class, 'index'])->middleware('role:ceo,marketing_specialist');
        Route::middleware('role:ceo,account_manager,confidential_informant,mechanic,sales_manager')->prefix('staff')->group(function () {
            Route::get('inspections', [InspectionController::class, 'index']);
            Route::get('inspections/{id}', [InspectionController::class, 'show']);
        });

        Route::post('admin/accounts/walk-in', [AccountAdminController::class, 'storeWalkIn'])->middleware('role:account_manager,ceo');
        // Notes Part 1: supplier accounts, their approval, the supplier portal and the staff view of supplier posts.
        Route::post('admin/accounts/supplier', [SupplierController::class, 'store'])->middleware('role:account_manager,ceo');
        Route::get('admin/suppliers', [SupplierController::class, 'approvals'])->middleware('role:account_manager,ceo');
        Route::post('admin/suppliers/decide', [SupplierController::class, 'decide'])->middleware('role:account_manager,ceo');
        Route::middleware('role:supplier')->prefix('supplier')->group(function () {
            Route::get('dashboard', [SupplierController::class, 'dashboard']);
            Route::post('posts', [SupplierController::class, 'storePost'])->middleware('throttle:20,1,supplier-posts');
            Route::post('posts/{id}', [SupplierController::class, 'updatePost']);
            Route::post('posts/{id}/withdraw', [SupplierController::class, 'withdrawPost']);
        });
        Route::middleware('role:'.implode(',', Role::SUPPLIER_POST_VIEWERS))->prefix('staff')->group(function () {
            Route::get('supplier-posts', [SupplierController::class, 'staffIndex']);
            Route::get('supplier-posts/{id}', [SupplierController::class, 'staffShow']);
            Route::post('supplier-posts/{id}/propose', [SupplierController::class, 'propose'])->middleware('role:marketing_specialist');
            Route::post('supplier-posts/{id}/decide', [SupplierController::class, 'ceoDecide'])->middleware('role:ceo');
            Route::post('supplier-posts/{id}/assign', [SupplierController::class, 'assign'])->middleware('role:marketing_specialist');
        });
        Route::post('admin/accounts/employee', [AccountAdminController::class, 'storeEmployee'])->middleware('role:ceo,account_manager');
        Route::post('admin/roles', [AccountAdminController::class, 'assignRole'])->middleware('role:ceo,super_admin');
        Route::post('admin/account-state', [StaffRecordController::class, 'accountState'])->middleware('role:ceo,account_manager,super_admin');
        // Administration (Phase 7): accounts, RBAC catalogue and settings. Super Admin is allowed here, never on business data.
        Route::get('admin/users', [AdminController::class, 'users'])->middleware('role:ceo,account_manager,super_admin');
        Route::middleware('role:ceo,super_admin')->group(function () {
            Route::get('admin/rbac', [AdminController::class, 'rbac']);
            Route::post('admin/rbac/roles', [AdminController::class, 'createRole']);
            Route::post('admin/rbac/roles/update', [AdminController::class, 'updateRole']);
            Route::post('admin/rbac/permissions', [AdminController::class, 'createPermission']);
            Route::get('admin/settings', [AdminController::class, 'settings']);
            Route::post('admin/settings/financing-markup', [AdminController::class, 'updateMarkup']);
        });

        // Trading, scheduling and field workflows (Phase 5). One POST per former Server Action; each
        // controller method re-checks the exact role and record rule of the action it replaces.
        Route::middleware('role:customer')->group(function () {
            Route::get('my-transactions', [CustomerTradingReadController::class, 'index']);
            Route::get('my-transactions/{id}', [CustomerTradingReadController::class, 'show']);
            Route::get('sell/checklist', [CustomerTradingReadController::class, 'checklist']);
            Route::post('trading/uploads', [CustomerTradingController::class, 'upload'])->middleware('throttle:120,1,uploads');
            Route::post('trading/sell/prepare-uploads', [SellIntakeController::class, 'prepareUploads'])->middleware('throttle:20,1,sell-prepare');
            Route::post('trading/sell', [SellIntakeController::class, 'submit'])->middleware('throttle:10,1,sell-submit');
            Route::post('trading/purchase-documents', [CustomerTradingController::class, 'uploadPurchaseDocument']);
            Route::post('trading/buy', [CustomerTradingController::class, 'createBuyTransaction']);
            Route::post('trading/buy-details', [CustomerTradingController::class, 'saveBuyDetails']);
            Route::post('trading/submit-buy-request', [CustomerTradingController::class, 'submitBuyRequest']);
            Route::post('trading/financing-offer', [CustomerTradingController::class, 'respondToFinancingOffer']);
            Route::post('trading/delivery-reschedule', [CustomerTradingController::class, 'requestDeliveryReschedule']);
            Route::post('trading/sign-contract', [CustomerTradingController::class, 'signContract']);
            Route::post('trading/cancel', [CustomerTradingController::class, 'cancelTransaction']);
            Route::post('trading/review', [CustomerTradingController::class, 'submitReview']);
            // Payments (Phase 6).
            Route::post('payments/checkout', [CheckoutController::class, 'startOnline'])->middleware('throttle:20,1,checkout');
            Route::post('payments/installment-checkout', [CheckoutController::class, 'startInstallment'])->middleware('throttle:20,1,installment-checkout');
            Route::post('inquiries', [InquiryWorkflowController::class, 'create']);
        });
        Route::get('field-cases/{id}/location', [FieldCaseActionController::class, 'location'])->middleware('throttle:polling');
        Route::post('inquiries/{id}/assign', [InquiryWorkflowController::class, 'assign'])->middleware('role:account_manager,sales_manager');
        Route::post('inquiries/{id}/handoff', [InquiryWorkflowController::class, 'handoff'])->middleware('role:account_manager');
        Route::post('inquiries/{id}/accept-handoff', [InquiryWorkflowController::class, 'acceptHandoff'])->middleware('role:sales_manager');
        Route::post('staff/arrangements', [InquiryWorkflowController::class, 'schedule'])->middleware('role:account_manager,sales_manager');
        Route::post('staff/message-reports/{id}/review', [InquiryWorkflowController::class, 'reviewReport'])->middleware('role:ceo,account_manager');
        Route::get('papers/{transactionId}/{paper}', [PapersReadController::class, 'show']);

        Route::middleware('role:'.implode(',', Role::STAFF))->prefix('staff')->group(function () {
            Route::get('field-workers', [StaffTradingReadController::class, 'fieldWorkers']);

            Route::get('dashboard', [DashboardController::class, 'index']);
            Route::get('insights', [DashboardController::class, 'insights'])->middleware('role:ceo,account_manager,sales_manager');
            // Staff operations (Phase 7). Each service re-checks the role rule of the Postgres function it replaces.
            Route::get('attendance', [AttendanceController::class, 'index']);
            Route::get('attendance/state', [AttendanceController::class, 'state']);
            Route::post('attendance/clock-in', [AttendanceController::class, 'clockIn'])->middleware('throttle:20,1,clock-in');
            Route::post('attendance/clock-out', [AttendanceController::class, 'clockOut'])->middleware('throttle:20,1,clock-out');
            Route::post('attendance/review', [AttendanceController::class, 'review'])->middleware('role:ceo,account_manager,head_accountant');
            Route::get('employee-requests', [EmployeeRequestController::class, 'index']);
            Route::post('employee-requests', [EmployeeRequestController::class, 'submit'])->middleware('throttle:20,1,employee-requests');
            Route::post('employee-requests/cancel', [EmployeeRequestController::class, 'cancel']);
            Route::post('employee-requests/review', [EmployeeRequestController::class, 'review'])->middleware('role:ceo,account_manager');
            Route::middleware('role:ceo,account_manager,head_accountant')->group(function () {
                Route::get('payroll', [PayrollController::class, 'index']);
                Route::get('payroll/runs/{id}', [PayrollController::class, 'runDetail']);
                Route::post('payroll/compensation', [PayrollController::class, 'saveCompensation']);
                Route::post('payroll/runs', [PayrollController::class, 'createRun']);
                Route::post('payroll/runs/review', [PayrollController::class, 'review']);
                Route::post('payroll/runs/finalize', [PayrollController::class, 'finalize']);
                Route::post('payroll/payslip-items', [PayrollController::class, 'addItem']);
                Route::post('payroll/payslips/mark-paid', [PayrollController::class, 'markPaid']);
                Route::post('payroll/payslips/drilldown', [PayrollController::class, 'drilldown']);
            });
            Route::get('payslips', [PayrollController::class, 'payslips']);
            Route::get('payslips/{id}', [PayrollController::class, 'payslip']);
            Route::middleware('role:ceo,head_accountant,account_manager')->group(function () {
                Route::get('reports', [ReportController::class, 'index']);
                Route::post('reports', [ReportController::class, 'submit']);
                Route::post('reports/review', [ReportController::class, 'review']);
            });
            Route::get('announcements', [AnnouncementController::class, 'index']);
            Route::middleware('role:ceo')->group(function () {
                Route::post('announcements', [AnnouncementController::class, 'create']);
                Route::post('announcements/{status}', [AnnouncementController::class, 'setStatus'])->whereIn('status', ['published', 'expired', 'archived']);
            });
            Route::get('security-duty-checks', [SecurityDutyController::class, 'index'])->middleware('role:ceo,head_security');
            Route::middleware('role:head_security')->group(function () {
                Route::post('security-duty-checks', [SecurityDutyController::class, 'start']);
                Route::post('security-duty-checks/evidence', [SecurityDutyController::class, 'upload'])->middleware('throttle:30,1,security-evidence');
                Route::post('security-duty-checks/complete', [SecurityDutyController::class, 'complete']);
            });
            Route::middleware('role:ceo,account_manager,sales_manager')->group(function () {
                Route::get('roadmap', [RoadmapController::class, 'index']);
                Route::get('roadmap/{id}', [RoadmapController::class, 'show']);
            });
            Route::middleware('role:ceo')->group(function () {
                Route::post('roadmap', [RoadmapController::class, 'create']);
                Route::post('roadmap/update', [RoadmapController::class, 'update']);
                Route::delete('roadmap/{id}', [RoadmapController::class, 'destroy']);
            });
            Route::get('staff-records', [StaffRecordController::class, 'index'])->middleware('role:ceo,account_manager,sales_manager');
            Route::post('staff-records/save', [StaffRecordController::class, 'save']);
            Route::post('staff-records/performance-reviews', [StaffRecordController::class, 'submitReview']);
            Route::post('staff-records/performance-reviews/update', [StaffRecordController::class, 'updateReview']);
            Route::get('vehicle-papers', [PapersReadController::class, 'index'])->middleware('role:confidential_informant,ceo');
            Route::get('transactions', [StaffTradingReadController::class, 'index'])->middleware('role:'.implode(',', Role::TRANSACTION_VIEWERS));
            Route::get('transactions/{id}', [StaffTradingReadController::class, 'show'])->middleware('role:'.implode(',', Role::TRANSACTION_VIEWERS));
            Route::get('sell-submissions', [FieldReadController::class, 'sellSubmissions'])->middleware('role:mechanic,confidential_informant');
            Route::get('field-cases', [FieldReadController::class, 'index'])->middleware('role:ceo,confidential_informant,sales_manager,mechanic,head_accountant,head_security');
            Route::get('field-cases/{id}', [FieldReadController::class, 'show']);

            // Buy requests (transactions/actions.ts, delivery-actions.ts, handover-actions.ts, financing visit).
            Route::post('trading/transition', [StaffTransactionController::class, 'transition'])->middleware('role:ceo,sales_manager,account_manager,head_accountant');
            Route::post('trading/buyer-decline', [StaffTransactionController::class, 'recordBuyerDecline']);
            Route::post('trading/no-show', [StaffTransactionController::class, 'recordNoShow']);
            Route::post('trading/promote', [StaffTransactionController::class, 'promoteQueuedRequest']);
            Route::post('trading/verify-document', [StaffTransactionController::class, 'verifyTransactionDocument']);
            Route::post('trading/walk-in', [StaffTransactionController::class, 'createWalkInTransaction']);
            Route::post('trading/field-cases', [StaffTransactionController::class, 'createFieldCase']);
            Route::post('trading/assign-mechanic', [StaffTransactionController::class, 'assignMechanic']);
            Route::post('trading/repossession', [StaffTransactionController::class, 'instructRepossession']);
            Route::middleware('role:sales_manager,ceo')->group(function () {
                Route::post('trading/delivery-terms', [DeliveryController::class, 'setDeliveryTerms']);
                Route::post('trading/delivery-case', [DeliveryController::class, 'createDeliveryFieldCase']);
                Route::post('trading/meetup-case', [DeliveryController::class, 'createMeetupFieldCase']);
                Route::post('trading/delivery-delay', [DeliveryController::class, 'relayDeliveryDelay']);
                Route::post('trading/cancel-unpaid-delivery', [DeliveryController::class, 'cancelUnpaidDelivery']);
            });
            foreach (['requestPapersRelease', 'approvePapersRelease', 'receivePapers', 'releasePapersToCi', 'handPapersToBuyer', 'saveContract', 'reviewContract',
                'recordBuyerMet', 'reportSigning', 'recordFaceToFaceSigning', 'recordContractCopy', 'uploadFieldDocument', 'recordFieldSignatures', 'recordSmSignature'] as $action) {
                Route::post('trading/handover/'.Str::kebab($action), [HandoverController::class, $action]);
            }
            Route::post('trading/visit-decision', [FinancingVisitController::class, 'recordVisitDecision']);

            // Payments (Phase 6, payment-actions.ts and payment-review-actions.ts).
            Route::post('payments/record', [PaymentController::class, 'record']);
            Route::post('payments/advance', [PaymentController::class, 'recordAdvance']);
            Route::post('payments/verify', [PaymentController::class, 'verify']);
            Route::post('payments/waive-installment', [PaymentController::class, 'waive']);
            Route::post('payments/approve-online', [PaymentController::class, 'approveOnline']);
            Route::post('payments/reject', [PaymentController::class, 'reject']);
            // Financing terms (financing-terms-actions.ts).
            Route::post('financing/propose', [FinancingTermsController::class, 'propose']);
            Route::post('financing/review', [FinancingTermsController::class, 'review']);
            Route::post('financing/confirm', [FinancingTermsController::class, 'confirm']);
            Route::post('financing/complete', [FinancingTermsController::class, 'complete']);
            // Finance page writes (finance/actions.ts) and reconditioning funds (reconditioning-fund-actions.ts).
            foreach (['recordEntry', 'verifyEntry', 'createDisbursement', 'requestPurchaseFunds', 'recordSellerPaid', 'advance', 'markExpenseReimbursed'] as $action) {
                Route::post('finance/'.Str::kebab($action), [FinanceController::class, $action]);
            }
            Route::get('finance', [FinanceReadController::class, 'finance'])->middleware('role:ceo,head_accountant,account_manager,confidential_informant');
            Route::get('financing', [FinanceReadController::class, 'financing'])->middleware('role:ceo,head_accountant');
            Route::post('field-budget/request', [FieldBudgetController::class, 'request']);
            Route::post('field-budget/return', [FieldBudgetController::class, 'recordReturn']);
            Route::post('field-budget/confirm-return', [FieldBudgetController::class, 'confirmReturn']);
            Route::post('reconditioning/request-funds', [ReconditioningController::class, 'requestFunds']);
            Route::post('reconditioning/refund-returned', [ReconditioningController::class, 'markRefundReturned']);
            Route::post('trading/vehicle-recovered', [FinancingVisitController::class, 'recordVehicleRecovered']);

            // SN-3: the Marketing Specialist sends the bought car's OR/CR/Deed photos to the Confidential Informant.
            Route::post('trading/sell/capture-papers', [SellPapersController::class, 'capture'])->middleware('role:marketing_specialist,ceo');
            // BC-7: the papers that came with the car, for the people who sell it on.
            Route::get('transactions/{id}/car-papers', [PapersReadController::class, 'carPapers'])
                ->middleware('role:sales_manager,ceo,confidential_informant,head_accountant');
            // Sell offers (sell-actions.ts).
            Route::middleware('role:marketing_specialist')->group(function () {
                foreach (['flagSellSubmission', 'proposePurchaseCeiling', 'recordAgreedPrice', 'createInspectionIssueReport', 'recordSellerResponse'] as $action) {
                    Route::post('trading/sell/'.Str::kebab($action), [SellFlowController::class, $action]);
                }
            });

            // Field teams (field-cases/*-actions.ts).
            foreach (['updateFieldCase', 'advanceDeliveryStatus', 'reportDeliveryDelay', 'receiveFieldCase', 'updateDeliveryLocation', 'advanceRecovery',
                'uploadTowEvidence', 'updateRecoveryLocation', 'confirmFieldCheck', 'reportInspection', 'fileFieldExpense', 'recordFieldPrice'] as $action) {
                Route::post('field/'.Str::kebab($action), [FieldCaseActionController::class, $action]);
            }

            // Vehicles, prices, inspections and reconditioning (vehicles/actions.ts, reconditioning-actions.ts).
            Route::post('vehicles', [VehicleWriteController::class, 'createVehicle']);
            Route::post('vehicles/update', [VehicleWriteController::class, 'updateVehicle']);
            Route::post('vehicles/publish', [VehicleWriteController::class, 'publishVehicle']);
            Route::post('vehicles/propose-price', [VehicleWriteController::class, 'proposePrice']);
            Route::post('vehicles/approve-price', [VehicleWriteController::class, 'approvePrice']);
            Route::post('vehicles/{vehicleId}/archive', [VehicleWriteController::class, 'archiveVehicle']);
            Route::post('inspections', [VehicleWriteController::class, 'createInspection']);
            Route::post('inspections/answer', [VehicleWriteController::class, 'submitChecklistAnswer']);
            Route::post('reconditioning/report', [ReconditioningController::class, 'submitReport']);
            Route::post('reconditioning/start', [ReconditioningController::class, 'start']);
            Route::post('reconditioning/complete', [ReconditioningController::class, 'complete']);
        });
    });
});
