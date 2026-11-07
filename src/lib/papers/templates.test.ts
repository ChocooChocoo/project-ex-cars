import { describe, expect, it } from "vitest";

import { GCE_SELLER } from "../transactions/buy-flow";
import { deedOfSale, missedPaymentPolicy, PAPER_BLANK, paperFinancing, paperSale, policyWarranty } from "./templates";

const policyRow = {
  opened_at: "2026-10-31T02:00:00.000Z",
  completed_at: null,
  purchase_details: { final_price: 500000 },
  profiles: { full_name: "Maria Santos", address: "12 Mabini St, Batangas City" },
  vehicles: { make: "Toyota", model: "Vios", year: 2022, exterior_color: "Pearl White" },
  payment_terms: {
    total_amount: 500000,
    down_payment: 50000,
    duration_months: 24,
    monthly_payment: 18750,
    first_due_date: "2026-12-01",
  },
  installment_accounts: { opening_balance: 450000 },
};

it("fills the missed payment policy with the client, the car and the money", () => {
  const salerow = paperSale(policyRow);
  const paper = missedPaymentPolicy(salerow, paperFinancing(policyRow));
  const text = [paper.title, ...paper.paragraphs].join("\n");

  expect(paper.title).toBe("MISSED PAYMENT POLICY");
  expect(text).toContain("Maria Santos");
  expect(text).toContain("12 Mabini St, Batangas City");
  expect(text).toContain("Make: Toyota");
  expect(text).toContain("Model: Vios");
  expect(text).toContain("Amount financed: PHP 450,000.00");
  expect(text).toContain("Monthly installment: PHP 18,750.00");
  expect(text).toContain("Term: 24 months");
  expect(text).toContain("Four (4) consecutive missed monthly payments");
  expect(text).toContain("Signature over printed name");
});

it("keeps a blank line where the financing record is missing", () => {
  const financing = paperFinancing({ ...saleRow, payment_terms: null, installment_accounts: null });
  expect(financing.downPayment).toBe(PAPER_BLANK);
  expect(financing.term).toBe(PAPER_BLANK);
});

const saleRow = {
  opened_at: "2026-10-31T02:00:00.000Z",
  completed_at: null,
  purchase_details: { final_price: 500000 },
  profiles: { full_name: "Maria Santos", address: "12 Mabini St, Batangas City" },
  vehicles: {
    make: "Toyota",
    model: "Vios",
    year: 2022,
    exterior_color: "Pearl White",
    plate_number: null,
    engine_number: "ENG-9",
    chassis_number: null,
    vin: "VIN-123",
    warranty_details: "1 year engine warranty",
  },
};

const textOf = (document: { title: string; paragraphs: string[] }) =>
  [document.title, ...document.paragraphs].join("\n");

describe("deed of sale fill", () => {
  it("prints a blank line where the plate number is missing", () => {
    expect(textOf(deedOfSale(paperSale(saleRow)))).toContain(`Plate No.: ${PAPER_BLANK}`);
  });

  it("names the buyer from the transaction's customer", () => {
    const sale = paperSale(saleRow);
    expect(sale.buyer.name).toBe("Maria Santos");
    expect(textOf(deedOfSale(sale))).toContain("unto Maria Santos");
    expect(textOf(deedOfSale(sale))).toContain("12 Mabini St, Batangas City");
  });

  it("falls back to the VIN when there is no chassis number", () => {
    expect(textOf(deedOfSale(paperSale(saleRow)))).toContain("Chassis No.: VIN-123");
  });

  it("prints the agreed price and the sale date", () => {
    const text = textOf(deedOfSale(paperSale(saleRow)));
    expect(text).toContain("PHP 500,000.00");
    expect(text).toContain("October 31, 2026");
  });

  it("carries GCE's seller name and the car's other identifiers", () => {
    const text = textOf(deedOfSale(paperSale(saleRow)));
    expect(text).toContain(GCE_SELLER);
    expect(text).toContain("Make: Toyota");
    expect(text).toContain("Model: Vios");
    expect(text).toContain("Year: 2022");
    expect(text).toContain("Color: Pearl White");
    expect(text).toContain("Engine No.: ENG-9");
  });

  it("unwraps the relations PostgREST returns as arrays", () => {
    const sale = paperSale({
      opened_at: "2026-10-31T02:00:00.000Z",
      completed_at: null,
      purchase_details: [{ final_price: 400000 }],
      profiles: [{ full_name: "Ana Cruz", address: null }],
      vehicles: [{ make: "Honda", model: "City", year: 2021, vin: null }],
    });
    expect(sale.buyer.name).toBe("Ana Cruz");
    expect(textOf(deedOfSale(sale))).toContain(`postal address at ${PAPER_BLANK}`);
  });
});

describe("policy and warranty fill", () => {
  it("prints the car's warranty terms as a draft for client review", () => {
    const text = textOf(policyWarranty(paperSale(saleRow)));
    expect(text).toContain("POLICY & WARRANTY");
    expect(text).toContain("DRAFT");
    expect(text).toContain("1 year engine warranty");
  });

  it("prints a blank line when the car has no warranty on record", () => {
    const text = textOf(
      policyWarranty(paperSale({ ...saleRow, vehicles: { ...saleRow.vehicles, warranty_details: null } })),
    );
    expect(text).toContain(`Warranty: ${PAPER_BLANK}`);
  });
});
