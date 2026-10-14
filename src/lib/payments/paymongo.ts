import { createHmac, timingSafeEqual } from "node:crypto";

// PayMongo Checkout (https://docs.paymongo.com): Pay opens a hosted Checkout Session for the exact amounts,
// and PayMongo's webhook says when it is paid. Plain fetch; amounts go to PayMongo in centavos.

const API = "https://api.paymongo.com/v1/checkout_sessions";
const METHODS = ["card", "gcash", "paymaya", "dob"];
// A signed webhook older than this is refused as a replay.
const MAX_AGE_SECONDS = 300;

export type CheckoutLine = { name: string; amount: number };

function headers(secretKey: string) {
  return {
    Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

async function send(url: string, init: RequestInit) {
  const response = await fetch(url, init);
  const json = await response.json().catch(() => null);
  if (!response.ok) throw new Error(json?.errors?.[0]?.detail ?? `PayMongo answered ${response.status}.`);
  return json;
}

export async function createCheckoutSession(
  secretKey: string,
  input: { lineItems: CheckoutLine[]; referenceNumber: string; successUrl: string; cancelUrl: string },
): Promise<{ id: string; checkoutUrl: string }> {
  const json = await send(API, {
    method: "POST",
    headers: headers(secretKey),
    body: JSON.stringify({
      data: {
        attributes: {
          line_items: input.lineItems.map((line) => ({
            name: line.name,
            amount: Math.round(line.amount * 100),
            currency: "PHP",
            quantity: 1,
          })),
          payment_method_types: METHODS,
          reference_number: input.referenceNumber,
          success_url: input.successUrl,
          cancel_url: input.cancelUrl,
          send_email_receipt: true,
        },
      },
    }),
  });
  return { id: json.data.id, checkoutUrl: json.data.attributes.checkout_url };
}

// A session stays "active" after it is paid; paidPaymentId is set once one of its payments is paid.
export async function retrieveCheckoutSession(
  secretKey: string,
  id: string,
): Promise<{ id: string; status: string; checkoutUrl: string; paidPaymentId: string | null }> {
  const json = await send(`${API}/${id}`, { headers: headers(secretKey) });
  const attributes = json.data.attributes;
  const paid = (attributes.payments ?? []).find(
    (payment: { attributes?: { status?: string } }) => payment.attributes?.status === "paid",
  );
  return {
    id: json.data.id,
    status: attributes.status,
    checkoutUrl: attributes.checkout_url,
    paidPaymentId: paid?.id ?? null,
  };
}

// Paymongo-Signature is "t=<unix>,te=<test sig>,li=<live sig>"; each signature is HMAC-SHA256 of
// "<t>.<raw body>" with the webhook's secret.
export function verifyWebhookSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(",").map((part) => part.split("=", 2) as [string, string]));
  const t = Number(parts.t);
  if (!Number.isFinite(t) || Math.abs(nowSeconds - t) > MAX_AGE_SECONDS) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(`${parts.t}.${rawBody}`).digest("hex"));
  return [parts.te, parts.li].some((given) => {
    if (!given) return false;
    const buffer = Buffer.from(given);
    return buffer.length === expected.length && timingSafeEqual(buffer, expected);
  });
}

type Session = { id?: string; attributes?: { payments?: { id?: string }[] } };
type WebhookBody = {
  data?: { type?: string; data?: Session; attributes?: { type?: string; data?: Session } };
};

// The checkout session and payment of a "checkout_session.payment.paid" event, or null for any other event.
// PayMongo has sent the event both as data.attributes.{type,data} and as data.{type,data}.
export function readPaidCheckout(body: WebhookBody): { checkoutId: string; paymentId: string | null } | null {
  const type = body.data?.attributes?.type ?? body.data?.type;
  const session = body.data?.attributes?.data ?? body.data?.data;
  if (type !== "checkout_session.payment.paid" || !session?.id) return null;
  return { checkoutId: session.id, paymentId: session.attributes?.payments?.[0]?.id ?? null };
}
