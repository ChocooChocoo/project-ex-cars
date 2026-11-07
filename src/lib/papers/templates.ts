// The two papers the Confidential Informant prints, filled in from GCE's records. The wording lives
// here and only here, so a change to the Deed of Sale or the Policy & Warranty is one edit.

import { GCE_SELLER } from "@/lib/transactions/buy-flow";

// What a line reads when GCE has no value for it: the CI writes it in by hand before signing.
export const PAPER_BLANK = "________";

type Embedded<T> = T | T[] | null;

interface VehicleSource {
  make?: string | null;
  model?: string | null;
  year?: number | string | null;
  exterior_color?: string | null;
  plate_number?: string | null;
  engine_number?: string | null;
  chassis_number?: string | null;
  vin?: string | null;
  warranty_details?: string | null;
}

// The joined transaction row the print pages read: the buyer is `transactions.customer_id`, so
// `profiles` is the transaction's own customer, and the car is the one on the sale.
export interface TransactionPaperSource {
  opened_at?: string | null;
  completed_at?: string | null;
  purchase_details: Embedded<{ final_price?: number | string | null }>;
  profiles: Embedded<{ full_name?: string | null; address?: string | null }>;
  vehicles: Embedded<VehicleSource>;
  payment_terms?: Embedded<{
    total_amount?: number | string | null;
    down_payment?: number | string | null;
    duration_months?: number | string | null;
    number_of_payments?: number | string | null;
    monthly_payment?: number | string | null;
    first_due_date?: string | null;
  }>;
  installment_accounts?: Embedded<{ opening_balance?: number | string | null }>;
}

export interface PaperSale {
  buyer: { name: string; address: string };
  vehicle: {
    make: string;
    model: string;
    year: string;
    color: string;
    plate: string;
    engine: string;
    chassis: string;
    warranty: string;
  };
  price: string;
  date: string;
}

export interface PaperFinancing {
  price: string;
  downPayment: string;
  financed: string;
  monthly: string;
  term: string;
  firstDue: string;
}

export interface PaperDocument {
  title: string;
  paragraphs: string[];
}

function one<T>(value: Embedded<T>): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

// The fixed financing policy, filled in with the client, the car and the money. The same wording is
// printed for every sale; only the recorded values change.
export function missedPaymentPolicy(sale: PaperSale, financing: PaperFinancing): PaperDocument {
  return {
    title: "MISSED PAYMENT POLICY",
    paragraphs: [
      "This policy forms part of the financing agreement between GCE and the client named below. It explains what happens when the monthly installments are not paid.",
      `CLIENT\nName: ${sale.buyer.name}\nAddress: ${sale.buyer.address}`,
      `MOTOR VEHICLE FINANCED\n${vehicleLines(sale)}`,
      `FINANCING\n${financingLines(financing)}`,
      [
        "1. The client pays one monthly installment on or before each due date in the schedule.",
        "2. Four (4) consecutive missed monthly payments is a default under this agreement.",
        "3. On default, GCE may tow and take back the motor vehicle described above, with prior written notice to the client at the address stated here.",
        "4. Towing, storage and recovery costs are for the client's account and are added to the outstanding balance.",
        "5. The client may stop the towing by paying every missed installment and these costs in full before the recovery team takes the vehicle.",
        "6. Returning the vehicle voluntarily does not cancel the remaining balance unless GCE accepts the surrender in writing.",
      ].join("\n"),
      `CLIENT\nSignature over printed name: ______________________________\nPrinted name: ${sale.buyer.name}\nDate: ____________________`,
      "GCE REPRESENTATIVE\nSignature over printed name: ______________________________\nPrinted name: ______________________________\nDate: ____________________",
    ],
  };
}

// One financing sale as the policy states it. `opening_balance` is what GCE financed; when the
// account is missing, the amount is price minus downpayment.
export function paperFinancing(row: TransactionPaperSource): PaperFinancing {
  const details = one(row.purchase_details);
  const terms = one(row.payment_terms);
  const account = one(row.installment_accounts);
  const price = Number(terms?.total_amount ?? details?.final_price ?? Number.NaN);
  const down = Number(terms?.down_payment ?? Number.NaN);
  const opening = Number(account?.opening_balance ?? Number.NaN);
  const financed = Number.isFinite(opening)
    ? opening
    : Number.isFinite(price) && Number.isFinite(down)
      ? price - down
      : Number.NaN;
  const term = terms?.duration_months ?? terms?.number_of_payments ?? null;
  const monthly = Number(
    terms?.monthly_payment ?? (Number.isFinite(financed) && Number(term) > 0 ? financed / Number(term) : Number.NaN),
  );

  return {
    price: printedPrice(Number.isFinite(price) ? price : null),
    downPayment: printedPrice(Number.isFinite(down) ? down : null),
    financed: printedPrice(Number.isFinite(financed) ? financed : null),
    monthly: printedPrice(Number.isFinite(monthly) ? monthly : null),
    term: term === null || String(term).trim() === "" ? PAPER_BLANK : `${term} months`,
    firstDue: printedDate(terms?.first_due_date ?? null),
  };
}

function financingLines(financing: PaperFinancing): string {
  return [
    `Total contract price: ${financing.price}`,
    `Initial Downpayment: ${financing.downPayment}`,
    `Amount financed: ${financing.financed}`,
    `Monthly installment: ${financing.monthly}`,
    `Term: ${financing.term}`,
    `First installment due: ${financing.firstDue}`,
  ].join("\n");
}

function printed(value: unknown): string {
  if (value === null || value === undefined) return PAPER_BLANK;
  const text = String(value).trim();
  return text === "" ? PAPER_BLANK : text;
}

const PESO = new Intl.NumberFormat("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const LONG_DATE = new Intl.DateTimeFormat("en-PH", { dateStyle: "long", timeZone: "Asia/Manila" });

function printedPrice(value: unknown): string {
  if (value === null || value === undefined || value === "") return PAPER_BLANK;
  const amount = Number(value);
  return Number.isFinite(amount) ? `PHP ${PESO.format(amount)}` : PAPER_BLANK;
}

function printedDate(value: unknown): string {
  if (!value) return PAPER_BLANK;
  const at = new Date(String(value));
  return Number.isNaN(at.getTime()) ? PAPER_BLANK : LONG_DATE.format(at);
}

// One sale as the papers state it. A missing plate, engine or chassis number stays a blank line; a
// missing chassis number falls back to the VIN GCE already records on the car.
export function paperSale(row: TransactionPaperSource): PaperSale {
  const car = one(row.vehicles);
  const buyer = one(row.profiles);
  const details = one(row.purchase_details);
  const chassis = printed(car?.chassis_number);

  return {
    buyer: {
      name: printed(buyer?.full_name),
      address: printed(buyer?.address),
    },
    vehicle: {
      make: printed(car?.make),
      model: printed(car?.model),
      year: printed(car?.year),
      color: printed(car?.exterior_color),
      plate: printed(car?.plate_number),
      engine: printed(car?.engine_number),
      chassis: chassis === PAPER_BLANK ? printed(car?.vin) : chassis,
      warranty: printed(car?.warranty_details),
    },
    price: printedPrice(details?.final_price),
    date: printedDate(row.completed_at ?? row.opened_at),
  };
}

function vehicleLines(sale: PaperSale): string {
  return [
    `Make: ${sale.vehicle.make}`,
    `Model: ${sale.vehicle.model}`,
    `Year: ${sale.vehicle.year}`,
    `Color: ${sale.vehicle.color}`,
    `Plate No.: ${sale.vehicle.plate}`,
    `Engine No.: ${sale.vehicle.engine}`,
    `Chassis No.: ${sale.vehicle.chassis}`,
  ].join("\n");
}

export function deedOfSale(sale: PaperSale): PaperDocument {
  return {
    title: "DEED OF SALE",
    paragraphs: [
      "KNOW ALL MEN BY THESE PRESENTS:",
      `That ${GCE_SELLER}, a business duly organized and existing under Philippine law, hereinafter referred to as the SELLER, for and in consideration of the total sum of ${sale.price}, receipt of which is hereby acknowledged, does hereby SELL, TRANSFER and CONVEY unto ${sale.buyer.name}, of legal age, with residence and postal address at ${sale.buyer.address}, hereinafter referred to as the BUYER, one (1) motor vehicle described as follows:`,
      vehicleLines(sale),
      "That the SELLER is the absolute owner of the motor vehicle described above and warrants that the same is free from all liens and encumbrances.",
      `IN WITNESS WHEREOF, the SELLER and the BUYER have signed this Deed on ${sale.date}.`,
      `SELLER: ${GCE_SELLER}\nBy: ______________________________`,
      `BUYER: ${sale.buyer.name}\nSignature: ______________________________`,
    ],
  };
}

export function policyWarranty(sale: PaperSale): PaperDocument {
  return {
    title: "POLICY & WARRANTY",
    paragraphs: [
      "DRAFT — for client review. GCE has not issued the final Policy & Warranty terms yet.",
      `This Policy & Warranty covers the motor vehicle sold by ${GCE_SELLER} to ${sale.buyer.name} on ${sale.date}, described as follows:`,
      `${vehicleLines(sale)}\nWarranty: ${sale.vehicle.warranty}`,
      "GCE repairs or replaces, at its option, any part covered by this warranty that fails because of a defect in materials or workmanship within the warranty period.",
      "This warranty does not cover damage from an accident, misuse, neglect, unauthorized repairs, or normal wear on consumable parts.",
      "The warranty is void if the vehicle is repaired outside GCE or its authorized service partners.",
      "The buyer keeps this Policy & Warranty together with the Deed of Sale and presents it when claiming a repair.",
      `Issued by ${GCE_SELLER} on ${sale.date}.`,
    ],
  };
}
