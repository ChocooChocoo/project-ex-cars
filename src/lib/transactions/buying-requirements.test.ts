import { describe, expect, it } from "vitest";

import { BUYING_PAYMENT_OPTIONS, BUYING_RECEIVING_OPTIONS, buyingRequirements } from "./buying-requirements";

describe("T12 buying requirements", () => {
  it("asks every combination for the two IDs and the proof of billing", () => {
    for (const payment of BUYING_PAYMENT_OPTIONS) {
      for (const receiving of BUYING_RECEIVING_OPTIONS) {
        const { documents } = buyingRequirements(payment.value, receiving.value);
        expect(documents.some((doc) => doc.startsWith("Two different valid IDs"))).toBe(true);
        expect(documents.some((doc) => doc.includes("proof of billing"))).toBe(true);
      }
    }
  });

  it("SN-15: asks for the originals and two printed back-to-back copies, each signed three times", () => {
    const { documents } = buyingRequirements("cash", "gce_visit");
    const ids = documents.find((doc) => doc.startsWith("Two different valid IDs"));
    expect(ids).toBe(
      "Two different valid IDs. Bring the originals and two printed back-to-back photocopies of each ID, each copy signed three times.",
    );
    expect(documents).toContain("One recent proof of billing in your name (electric, water or internet bill).");
  });

  it("SN-15: asks financing for a payslip and never for the OR/CR", () => {
    const { documents, information } = buyingRequirements("financing", "delivery");
    expect(documents).toContain("Payslip (latest)");
    expect(information).toContain("Bring your latest payslip; GCE checks it during the financing review.");
    expect([...documents, ...information].join(" ")).not.toMatch(/OR\/CR/);
    expect(buyingRequirements("cash", "delivery").documents).not.toContain("Payslip (latest)");
    expect(buyingRequirements("cash", "delivery").information.join(" ")).not.toMatch(/payslip/i);
  });

  it("follows the receiving method", () => {
    expect(buyingRequirements("cash", "delivery").information).toContain("Your complete delivery address");
    expect(buyingRequirements("cash", "meetup").information).toContain("The meet-up location, within CALABARZON only");
    expect(buyingRequirements("cash", "gce_visit").information.join(" ")).not.toMatch(/delivery/i);
  });
});
