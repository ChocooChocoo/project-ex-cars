import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createCheckoutSession, readPaidCheckout, retrieveCheckoutSession, verifyWebhookSignature } from "./paymongo";
import { createHmac } from "node:crypto";

const SECRET = "whsk_test_secret";
const body = JSON.stringify({ data: { id: "evt_1" } });
const sign = (t: number, payload = body, secret = SECRET) =>
  createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");

describe("verifyWebhookSignature", () => {
  const now = 1_800_000_000;

  it("accepts a test-mode signature made with the webhook secret", () => {
    expect(verifyWebhookSignature(body, `t=${now},te=${sign(now)},li=`, SECRET, now)).toBe(true);
  });

  it("accepts a live-mode signature", () => {
    expect(verifyWebhookSignature(body, `t=${now},te=,li=${sign(now)}`, SECRET, now)).toBe(true);
  });

  it("refuses a wrong secret, a changed body, an old timestamp and a missing header", () => {
    expect(verifyWebhookSignature(body, `t=${now},te=${sign(now, body, "other")},li=`, SECRET, now)).toBe(false);
    expect(verifyWebhookSignature(`${body} `, `t=${now},te=${sign(now)},li=`, SECRET, now)).toBe(false);
    expect(verifyWebhookSignature(body, `t=${now},te=${sign(now)},li=`, SECRET, now + 600)).toBe(false);
    expect(verifyWebhookSignature(body, null, SECRET, now)).toBe(false);
  });
});

describe("checkout sessions", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("creates a session in centavos for card, GCash, Maya and online banking", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ data: { id: "cs_1", attributes: { checkout_url: "https://checkout.paymongo.com/cs_1" } } }),
      ),
    );

    await expect(
      createCheckoutSession("sk_test_x", {
        lineItems: [{ name: "Delivery Fee", amount: 2500.5 }],
        referenceNumber: "TX-1",
        successUrl: "https://gce/s",
        cancelUrl: "https://gce/c",
      }),
    ).resolves.toEqual({ id: "cs_1", checkoutUrl: "https://checkout.paymongo.com/cs_1" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.paymongo.com/v1/checkout_sessions");
    expect(init.headers.Authorization).toBe(`Basic ${Buffer.from("sk_test_x:").toString("base64")}`);
    const attributes = JSON.parse(init.body).data.attributes;
    expect(attributes.line_items).toEqual([{ name: "Delivery Fee", amount: 250050, currency: "PHP", quantity: 1 }]);
    expect(attributes.payment_method_types).toEqual(["card", "gcash", "paymaya", "dob"]);
    expect(attributes).toMatchObject({
      reference_number: "TX-1",
      success_url: "https://gce/s",
      cancel_url: "https://gce/c",
    });
  });

  it("throws PayMongo's error detail", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ errors: [{ detail: "bad key" }] }), { status: 401 }));
    await expect(
      createCheckoutSession("sk_test_x", { lineItems: [], referenceNumber: "r", successUrl: "s", cancelUrl: "c" }),
    ).rejects.toThrow("bad key");
  });

  it("reports the paid payment of a session that is still active", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            id: "cs_1",
            attributes: {
              status: "active",
              checkout_url: "u",
              payments: [{ id: "pay_1", attributes: { status: "paid" } }],
            },
          },
        }),
      ),
    );
    await expect(retrieveCheckoutSession("sk_test_x", "cs_1")).resolves.toMatchObject({ paidPaymentId: "pay_1" });
  });

  it("reads a session's status and link", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: { id: "cs_1", attributes: { status: "expired", checkout_url: "u" } } })),
    );
    await expect(retrieveCheckoutSession("sk_test_x", "cs_1")).resolves.toEqual({
      id: "cs_1",
      status: "expired",
      checkoutUrl: "u",
      paidPaymentId: null,
    });
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.paymongo.com/v1/checkout_sessions/cs_1");
  });
});

describe("readPaidCheckout", () => {
  const session = { id: "cs_1", attributes: { payments: [{ id: "pay_1" }] } };

  it("reads the classic event shape", () => {
    expect(
      readPaidCheckout({ data: { attributes: { type: "checkout_session.payment.paid", data: session } } }),
    ).toEqual({ checkoutId: "cs_1", paymentId: "pay_1" });
  });

  it("reads the newer event shape", () => {
    expect(readPaidCheckout({ data: { type: "checkout_session.payment.paid", data: session } })).toEqual({
      checkoutId: "cs_1",
      paymentId: "pay_1",
    });
  });

  it("ignores other events", () => {
    expect(readPaidCheckout({ data: { attributes: { type: "payment.failed", data: session } } })).toBeNull();
  });
});
