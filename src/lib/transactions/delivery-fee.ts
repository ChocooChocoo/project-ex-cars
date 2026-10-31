// T05 P7: what a delivery costs, by the buyer's PSGC region, and the fixed 10% down payment.
// Region codes in `profiles.region_code` are nine digits; the first two name the region, which is all the
// delivery area needs.

export type DeliveryArea = "calabarzon" | "luzon" | "visayas" | "mindanao";

export interface DeliveryFeeRange {
  readonly min: number;
  readonly max: number;
}

export const DELIVERY_FEE_RANGES: Readonly<Record<DeliveryArea, DeliveryFeeRange>> = {
  calabarzon: { min: 0, max: 0 },
  luzon: { min: 8_000, max: 10_000 },
  visayas: { min: 10_000, max: 15_000 },
  mindanao: { min: 15_000, max: 20_000 },
};

export const DELIVERY_AREA_LABELS: Readonly<Record<DeliveryArea, string>> = {
  calabarzon: "CALABARZON",
  luzon: "Luzon",
  visayas: "Visayas",
  mindanao: "Mindanao",
};

// PSGC region prefixes. NIR (18) sits in Visayas; BARMM (15) and Caraga (16) sit in Mindanao.
const AREA_BY_REGION_PREFIX: Readonly<Record<string, DeliveryArea>> = {
  "01": "luzon",
  "02": "luzon",
  "03": "luzon",
  "04": "calabarzon",
  "05": "luzon",
  "06": "visayas",
  "07": "visayas",
  "08": "visayas",
  "09": "mindanao",
  "10": "mindanao",
  "11": "mindanao",
  "12": "mindanao",
  "13": "luzon",
  "14": "luzon",
  "15": "mindanao",
  "16": "mindanao",
  "17": "luzon",
  "18": "visayas",
  "19": "mindanao",
};

/** The delivery area a buyer's region falls in, or null when the profile has no usable region code. */
export function deliveryArea(regionCode: string | null | undefined): DeliveryArea | null {
  const prefix = regionCode?.slice(0, 2) ?? "";
  return AREA_BY_REGION_PREFIX[prefix] ?? null;
}

/** The range a Sales Manager reads, e.g. "₱10,000 – ₱15,000" or "Free delivery". */
export function deliveryFeeRangeLabel(area: DeliveryArea): string {
  const { min, max } = DELIVERY_FEE_RANGES[area];
  return min === max ? "Free delivery" : `₱${min.toLocaleString("en-PH")} – ₱${max.toLocaleString("en-PH")}`;
}

/** Whether a fee the Sales Manager typed falls inside the range for the area. */
export function feeWithinRange(area: DeliveryArea, fee: number): boolean {
  const { min, max } = DELIVERY_FEE_RANGES[area];
  return fee >= min && fee <= max;
}

/** The Initial Downpayment is fixed at 10% of the vehicle price, rounded to the peso. */
export function downPaymentFor(price: number): number {
  return Math.round(price * 0.1);
}
