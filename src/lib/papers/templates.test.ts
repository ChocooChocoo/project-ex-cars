import { describe, expect, it } from "vitest";

import { GCE_SELLER } from "../transactions/buy-flow";
import {
  contract,
  deedOfSale,
  missedPaymentPolicy,
  PAPER_BLANK,
  paperFinancing,
  paperSale,
  policyWarranty,
} from "./templates";

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

const signers = { buyerUrl: "https://api/buyer.png", gceName: "Sam Manager", gceRole: "Sales Manager", gceUrl: null };

describe("deed of sale signatures (BC-2 / BC-3)", () => {
  it("puts the buyer and GCE's representative in signature-over-printed-name blocks", () => {
    const paper = deedOfSale(paperSale(saleRow), signers);
    expect(paper.signatures).toEqual([
      {
        party: "BUYER",
        name: "Maria Santos",
        caption: "Signature over printed name",
        imageUrl: "https://api/buyer.png",
      },
      {
        party: `SELLER: ${GCE_SELLER}`,
        name: "By: Sam Manager",
        caption: "Signature over printed name (Sales Manager)",
        imageUrl: null,
      },
    ]);
  });

  it("keeps empty lines for a paper signed by pen", () => {
    const paper = deedOfSale(paperSale(saleRow));
    expect(paper.signatures?.map((block) => block.imageUrl)).toEqual([null, null]);
    expect(paper.signatures?.[1]?.name).toBe(`By: ${PAPER_BLANK}`);
  });
});

describe("policy and warranty fill (BC-6)", () => {
  it("prints GCE's standard warranty, the financing and the missed payment clauses with both signatures", () => {
    const paper = policyWarranty(paperSale(policyRow), paperFinancing(policyRow), signers);
    const text = textOf(paper);
    expect(text).toContain("POLICY & WARRANTY");
    expect(text).not.toContain("DRAFT");
    expect(text).toContain("WARRANTY");
    expect(text).toContain("Monthly installment: PHP 18,750.00");
    expect(text).toContain("Four (4) consecutive missed monthly payments");
    expect(paper.signatures).toHaveLength(2);
  });
});

describe("contract fill", () => {
  it("prints the contract body with the buyer, the car and the price", () => {
    const text = textOf(contract(paperSale(saleRow), "The buyer pays in 24 monthly installments.", signers));

    expect(text).toContain("CONTRACT");
    expect(text).toContain("The buyer pays in 24 monthly installments.");
    expect(text).toContain("Maria Santos");
    expect(text).toContain("Make: Toyota");
    expect(text).toContain("PHP 500,000.00");
    expect(text).toContain(GCE_SELLER);
  });

  it("signs on the sheet, not as text paths", () => {
    const paper = contract(paperSale(saleRow), null, signers);
    expect(textOf(paper)).not.toContain("Signature image:");
    expect(paper.signatures?.[0]?.imageUrl).toBe("https://api/buyer.png");
  });

  it("prints the blank line note when GCE has no contract body yet", () => {
    const text = textOf(contract(paperSale(saleRow), null, null));

    expect(text).toContain(`TERMS\n${PAPER_BLANK}`);
    expect(text).toContain("GCE has not recorded the contract terms yet.");
  });
});

describe("missed payment policy signatures", () => {
  it("appends the buyer and CI signature lines when they are recorded", () => {
    const signatures = { buyer: "tx/signature-buyer-1.png", ci: "tx/signature-ci-1.png" };
    const text = textOf(missedPaymentPolicy(paperSale(policyRow), paperFinancing(policyRow), signatures));

    expect(text).toContain("SIGNED BY");
    expect(text).toContain("Signature image: tx/signature-buyer-1.png");
    expect(text).toContain("Signature image: tx/signature-ci-1.png");
  });

  it("keeps the paper unchanged when no signatures are passed", () => {
    const text = textOf(missedPaymentPolicy(paperSale(policyRow), paperFinancing(policyRow)));

    expect(text).not.toContain("SIGNED BY");
  });
});
