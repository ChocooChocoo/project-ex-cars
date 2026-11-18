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

  it("asks financing for a payslip and never for the OR/CR", () => {
    const { documents, information } = buyingRequirements("financing", "delivery");
    expect(documents).toContain("Payslip (latest)");
    expect([...documents, ...information].join(" ")).not.toMatch(/OR\/CR/);
    expect(buyingRequirements("cash", "delivery").documents).not.toContain("Payslip (latest)");
  });

  it("follows the receiving method", () => {
    expect(buyingRequirements("cash", "delivery").information).toContain("Your complete delivery address");
    expect(buyingRequirements("cash", "meetup").information).toContain("The meet-up location, within CALABARZON only");
    expect(buyingRequirements("cash", "gce_visit").information.join(" ")).not.toMatch(/delivery/i);
  });
});
