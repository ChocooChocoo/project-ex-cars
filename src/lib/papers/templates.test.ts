import { describe, expect, it } from "vitest";

import { GCE_SELLER } from "../transactions/buy-flow";
import { deedOfSale, missedPaymentPolicy, PAPER_BLANK, paperSale, policyWarranty } from "./templates";

it("prints only the fixed missed payment policy", () => {
  expect(missedPaymentPolicy()).toEqual({
    title: "MISSED PAYMENT POLICY",
    paragraphs: [
      "After 4 consecutive missed monthly payments, GCE will tow and take back the car. The Head Accountant gives this policy to the client at delivery.",
    ],
  });
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
