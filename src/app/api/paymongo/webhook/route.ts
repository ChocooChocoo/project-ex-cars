import { markCheckoutPaid } from "@/lib/payments/checkout-paid";
import { readPaidCheckout, verifyWebhookSignature } from "@/lib/payments/paymongo";
import { createAdminClient } from "@/lib/supabase/admin";

// PayMongo calls this when a Checkout Session is paid. The signature is checked on the raw body first;
// the session's unpaid rows are then marked paid. A repeated event finds no unpaid rows and changes nothing.
export const runtime = "nodejs";

export async function POST(request: Request) {
  const raw = await request.text();
  const secret = process.env.PAYMONGO_WEBHOOK_SECRET ?? "";
  if (!verifyWebhookSignature(raw, request.headers.get("paymongo-signature"), secret)) {
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  let paid: ReturnType<typeof readPaidCheckout>;
  try {
    paid = readPaidCheckout(JSON.parse(raw));
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }
  if (paid) await markCheckoutPaid(createAdminClient(), paid.checkoutId, paid.paymentId);
  return Response.json({ received: true });
}
