import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { missedPaymentPolicy } from "@/lib/papers/templates";
import { MISSED_PAYMENT_POLICY } from "@/lib/transactions/missed-payment-policy";

import { PaperDocumentView } from "./paper-document-view";

it("prints the fixed policy with a working browser Print action", () => {
  const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
  render(
    <PaperDocumentView
      paper={missedPaymentPolicy()}
      heading="Missed payment policy"
      note="Print this policy for the client at delivery."
      backHref="/dashboard/transactions/tx"
      backLabel="Transaction"
    />,
  );
  expect(screen.getByRole("link", { name: "Transaction" })).toHaveAttribute("href", "/dashboard/transactions/tx");
  const printRoot = document.querySelector<HTMLElement>("[data-print-root]");
  expect(printRoot).not.toBeNull();
  expect(within(printRoot as HTMLElement).getByText(MISSED_PAYMENT_POLICY)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Print" }));
  expect(print).toHaveBeenCalledOnce();
  print.mockRestore();
});
