export const FUNDED_STATUSES = ["released", "received", "paid"] as const;

export type FundRequestLike = {
  amount_cents?: unknown;
  disbursement_requests?: { status?: unknown } | null;
};

export type PartLike = {
  estimated_cost?: unknown;
  estimated_cost_cents?: unknown;
};

const cents = (value: unknown) => Math.max(0, Math.round(Number(value ?? 0)));

// A part estimate may arrive in pesos (form input) or cents (database row).
export function partsTotalCents(parts: PartLike[]): number {
  return parts.reduce((total, part) => {
    if (part.estimated_cost_cents != null) return total + cents(part.estimated_cost_cents);
    return total + Math.round(Number(part.estimated_cost ?? 0) * 100);
  }, 0);
}

// Released money comes from the linked disbursement, not from the request itself.
export function releasedFundsCents(
  requests: FundRequestLike[],
  fallback?: { status?: unknown; amount_cents?: unknown } | null,
): number {
  if (requests.length === 0) {
    return FUNDED_STATUSES.includes(String(fallback?.status ?? "") as never) ? cents(fallback?.amount_cents) : 0;
  }
  return requests.reduce((total, request) => {
    const status = String(request.disbursement_requests?.status ?? "");
    return FUNDED_STATUSES.includes(status as never) ? total + cents(request.amount_cents) : total;
  }, 0);
}

export function reconditioningRefundCents(releasedCents: number, actualCostCents: number): number {
  return Math.max(0, cents(releasedCents) - cents(actualCostCents));
}
