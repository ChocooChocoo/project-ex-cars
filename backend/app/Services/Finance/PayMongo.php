<?php

namespace App\Services\Finance;

use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;

/**
 * PayMongo Checkout (was src/lib/payments/paymongo.ts): a hosted Checkout Session for the exact amounts, and
 * the webhook that says it was paid. Amounts go to PayMongo in centavos.
 */
class PayMongo
{
    private const API = 'https://api.paymongo.com/v1/checkout_sessions';

    private const METHODS = ['card', 'gcash', 'paymaya', 'dob'];

    /** A signed webhook older (or newer) than this is refused as a replay. */
    public const MAX_AGE_SECONDS = 300;

    public function configured(): bool
    {
        return (string) config('services.paymongo.secret_key') !== '';
    }

    /**
     * @param  list<array{name: string, cents: int}>  $lines
     * @param  array{name?: ?string, email?: ?string, phone?: ?string}  $billing
     * @return array{id: string, checkoutUrl: string}
     */
    public function create(array $lines, string $reference, string $successUrl, string $cancelUrl, array $billing = []): array
    {
        // T10: name/email (and phone when saved) so PayMongo does not ask; empty fields are left out.
        $billing = array_filter(array_map(fn ($v) => trim((string) $v), $billing), fn ($v) => $v !== '');
        $json = $this->send('post', self::API, ['data' => ['attributes' => array_filter([
            'line_items' => array_map(fn ($l) => ['name' => $l['name'], 'amount' => $l['cents'], 'currency' => 'PHP', 'quantity' => 1], $lines),
            'payment_method_types' => self::METHODS,
            'billing' => $billing ?: null,
            'reference_number' => $reference,
            'success_url' => $successUrl,
            'cancel_url' => $cancelUrl,
            'send_email_receipt' => true,
        ], fn ($v) => $v !== null)]]);

        return ['id' => $json['data']['id'], 'checkoutUrl' => $json['data']['attributes']['checkout_url']];
    }

    /**
     * A session stays "active" after it is paid; paidPaymentId is set once one of its payments is paid.
     *
     * @return array{id: string, status: string, checkoutUrl: string, paidPaymentId: ?string}
     */
    public function retrieve(string $id): array
    {
        $a = $this->send('get', self::API.'/'.$id)['data']['attributes'];
        $paid = collect($a['payments'] ?? [])->first(fn ($p) => ($p['attributes']['status'] ?? null) === 'paid');

        return ['id' => $id, 'status' => (string) $a['status'], 'checkoutUrl' => (string) $a['checkout_url'], 'paidPaymentId' => $paid['id'] ?? null];
    }

    /** Closes an unpaid session; an expired or paid one answers with an error, which is ignored. */
    public function expire(string $id): void
    {
        try {
            $this->send('post', self::API.'/'.$id.'/expire');
        } catch (\RuntimeException) {
        }
    }

    /**
     * Paymongo-Signature is "t=<unix>,te=<test sig>,li=<live sig>"; each is HMAC-SHA256 of "<t>.<raw body>".
     * Checked on the raw bytes, before the body is parsed.
     */
    public static function signatureValid(string $raw, ?string $header, string $secret, ?int $now = null): bool
    {
        if (! $header || $secret === '') {
            return false;
        }
        $parts = [];
        foreach (explode(',', $header) as $part) {
            [$k, $v] = array_pad(explode('=', $part, 2), 2, '');
            $parts[trim($k)] = trim($v);
        }
        if (! ctype_digit($parts['t'] ?? '') || abs(($now ?? time()) - (int) $parts['t']) > self::MAX_AGE_SECONDS) {
            return false;
        }
        $expected = hash_hmac('sha256', $parts['t'].'.'.$raw, $secret);
        foreach (['te', 'li'] as $key) {
            if (($parts[$key] ?? '') !== '' && hash_equals($expected, $parts[$key])) {
                return true;
            }
        }

        return false;
    }

    /**
     * The session and payment of a "checkout_session.payment.paid" event, or null for any other event. PayMongo
     * has sent it both as data.attributes.{type,data} and as data.{type,data}.
     *
     * @return array{checkoutId: string, paymentId: ?string, paidCents: ?int, currency: ?string, reference: ?string}|null
     */
    public static function paidCheckout(array $body): ?array
    {
        $type = $body['data']['attributes']['type'] ?? $body['data']['type'] ?? null;
        $session = $body['data']['attributes']['data'] ?? $body['data']['data'] ?? null;
        if ($type !== 'checkout_session.payment.paid' || ! is_array($session) || empty($session['id']) || ! is_string($session['id'])) {
            return null;
        }
        // Seen on the sandbox (19 Nov 2026): when the event fires, `payments` is still empty and the money is only on
        // `payment_intent` (status "processing"). The payment id is used when present, else the payment intent's id,
        // so the row always carries PayMongo's confirmation and the amount/currency are always matched.
        $payment = $session['attributes']['payments'][0] ?? null;
        $intent = $session['attributes']['payment_intent'] ?? null;
        $money = is_array($payment) ? $payment : $intent;
        $amount = $money['attributes']['amount'] ?? null;
        $id = $payment['id'] ?? $intent['id'] ?? null;

        return [
            'checkoutId' => $session['id'],
            'paymentId' => is_string($id) ? $id : null,
            'paidCents' => is_int($amount) ? $amount : null,
            'currency' => is_string($money['attributes']['currency'] ?? null) ? $money['attributes']['currency'] : null,
            'reference' => is_string($session['attributes']['reference_number'] ?? null) ? $session['attributes']['reference_number'] : null,
        ];
    }

    private function send(string $method, string $url, ?array $body = null): array
    {
        try {
            $response = Http::withBasicAuth((string) config('services.paymongo.secret_key'), '')
                ->acceptJson()->timeout(20)->{$method}($url, $body ?? [])->throw();
        } catch (RequestException $e) {
            throw new \RuntimeException($e->response->json('errors.0.detail') ?? 'PayMongo answered '.$e->response->status().'.', 0, $e);
        } catch (\Illuminate\Http\Client\ConnectionException $e) {
            throw new \RuntimeException('PayMongo could not be reached.', 0, $e);
        }

        return $response->json();
    }
}
