<?php

namespace App\Http\Controllers\Finance;

use App\Http\Controllers\Controller;
use App\Services\Finance\PayMongo;
use App\Services\Finance\Payments;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * PayMongo calls this when a Checkout Session is paid (was src/app/api/paymongo/webhook/route.ts). The signature
 * is checked on the raw request bytes before anything is parsed; then the session's unpaid rows are claimed, but
 * only when PayMongo's amount, currency and reference match them. A repeated event finds no unpaid rows.
 */
class PayMongoWebhookController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $raw = $request->getContent();
        if (! PayMongo::signatureValid($raw, $request->header('Paymongo-Signature'), (string) config('services.paymongo.webhook_secret'))) {
            return response()->json(['error' => 'Invalid signature'], 401);
        }
        $body = json_decode($raw, true);
        if (! is_array($body)) {
            return response()->json(['error' => 'Invalid body'], 400);
        }
        $paid = PayMongo::paidCheckout($body);
        if ($paid) {
            Payments::markCheckoutPaid($paid['checkoutId'], $paid['paymentId'], $paid['paidCents'], $paid['currency'], $paid['reference']);
        }

        return response()->json(['received' => true]);
    }
}
