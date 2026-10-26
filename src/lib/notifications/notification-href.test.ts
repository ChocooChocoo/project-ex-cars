import { describe, expect, it } from "vitest";

import { notificationHref } from "./notification-href";

const tx = { reference_table: "transactions", reference_id: "tx-1" };
const installment = { reference_table: "installments", reference_id: "inst-1" };
const installmentTransactions = new Map([["inst-1", "tx-9"]]);

describe("notificationHref (T03 G1)", () => {
  it("opens the customer's own transaction page", () => {
    expect(notificationHref(tx, "customer")).toBe("/customer/my-transactions/tx-1");
  });

  it("opens the staff transaction page for roles that have Transactions", () => {
    expect(notificationHref(tx, "sales_manager")).toBe("/sales_manager/transactions/tx-1");
    expect(notificationHref(tx, "head_accountant")).toBe("/head_accountant/transactions/tx-1");
    expect(notificationHref(tx, "ceo")).toBe("/ceo/transactions/tx-1");
  });

  it("gives no link to roles that cannot open the transaction list", () => {
    expect(notificationHref(tx, "mechanic")).toBeNull();
    expect(notificationHref(tx, "supplier")).toBeNull();
    expect(notificationHref(tx, null)).toBeNull();
  });

  it("opens an installment notification on its purchase transaction", () => {
    expect(notificationHref(installment, "account_manager", installmentTransactions)).toBe(
      "/account_manager/transactions/tx-9",
    );
    expect(
      notificationHref({ ...installment, reference_id: "unknown" }, "account_manager", installmentTransactions),
    ).toBeNull();
  });

  it("opens the assigned field case for field roles that cannot open transactions", () => {
    const fieldCases = new Map([["tx-1", "fc-7"]]);

    expect(notificationHref(tx, "mechanic", new Map(), fieldCases)).toBe("/mechanic/field-cases/fc-7");
    expect(notificationHref(tx, "head_security", new Map(), fieldCases)).toBe("/head_security/field-cases/fc-7");
    // Not assigned to a case on that transaction: no link.
    expect(notificationHref({ ...tx, reference_id: "tx-2" }, "mechanic", new Map(), fieldCases)).toBeNull();
    // Roles with Transactions keep the transaction page.
    expect(notificationHref(tx, "confidential_informant", new Map(), fieldCases)).toBe(
      "/confidential_informant/transactions/tx-1",
    );
  });

  it("gives no link without a reference or for an unknown table", () => {
    expect(notificationHref({ reference_table: null, reference_id: null }, "ceo")).toBeNull();
    expect(notificationHref({ reference_table: "vehicles", reference_id: "v-1" }, "ceo")).toBeNull();
  });
});
