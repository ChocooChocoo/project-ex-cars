import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import BuyingRequirementsPage from "./page";

const IDS_TEXT =
  "Prepare two different valid IDs. Bring the originals and two printed back-to-back photocopies of each ID, each copy signed three times. Both IDs must come from the list below, current (not expired) and in your name.";
const BILLING_TEXT =
  "Prepare one recent proof of billing in your name (electric, water or internet bill). Staff must verify it before your purchase can be completed.";

describe("SN-15: the buying guide states what to bring", () => {
  it("asks for the originals and two printed back-to-back copies of each ID, each signed three times", () => {
    render(<BuyingRequirementsPage />);

    expect(screen.getByText(IDS_TEXT)).toBeInTheDocument();
  });

  it("asks for one recent proof of billing in the buyer's name", () => {
    render(<BuyingRequirementsPage />);

    expect(screen.getByText(BILLING_TEXT)).toBeInTheDocument();
  });

  it("keeps the latest payslip and says GCE checks it during the financing review", () => {
    render(<BuyingRequirementsPage />);

    expect(
      screen.getByText(
        /A payslip is needed only for In-House Financing.*Cash and bank transfer buyers do not need one\./,
      ),
    ).toBeInTheDocument();
  });

  it("mirrors the same wording in the picker items", () => {
    render(<BuyingRequirementsPage />);

    fireEvent.click(screen.getByRole("radio", { name: /^In-House Financing/ }));
    fireEvent.click(screen.getByRole("radio", { name: /^GCE Visit/ }));

    const picker = screen.getByRole("heading", { name: "3. Requirements" }).parentElement as HTMLElement;
    expect(picker).toHaveTextContent(
      "Two different valid IDs. Bring the originals and two printed back-to-back photocopies of each ID, each copy signed three times.",
    );
    expect(picker).toHaveTextContent("One recent proof of billing in your name (electric, water or internet bill).");
    expect(picker).toHaveTextContent("Payslip (latest)");
    expect(picker).toHaveTextContent("Bring your latest payslip; GCE checks it during the financing review.");
  });
});
