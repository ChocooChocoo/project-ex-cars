import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SellSubmissionsList, type SellSubmissionListing } from "./sell-submissions-list";

const base: SellSubmissionListing = {
  transactionId: "11111111-2222-4333-8444-555555555555",
  state: "pending",
  openedAt: "2026-09-01T12:00:00.000Z",
  vehicleLabel: "Honda Walkthrough Civic (2019)",
  conditionItems: ["Exterior scratches"],
  photos: [{ id: "doc-1", is_image: true, signed_url: "https://storage.test/signed/sell-photo.jpg?token=x" }],
};

describe("SellSubmissionsList", () => {
  it("shows the car, the signed photo and the reported issues", () => {
    render(<SellSubmissionsList submissions={[base]} />);

    expect(screen.getByText("Honda Walkthrough Civic (2019)")).toBeInTheDocument();
    expect(screen.getByText("1 photo")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /photo 1/ })).toHaveAttribute(
      "src",
      "https://storage.test/signed/sell-photo.jpg?token=x",
    );
    expect(screen.getByText("Exterior scratches")).toBeInTheDocument();
    expect(screen.getByText(/#11111111/)).toBeInTheDocument();
  });

  it("falls back to a placeholder when the customer sent no vehicle details", () => {
    render(<SellSubmissionsList submissions={[{ ...base, vehicleLabel: null, photos: [], conditionItems: ["Brakes"] }]} />);

    expect(screen.getByText("Car not recorded")).toBeInTheDocument();
    expect(screen.getByText("0 photos")).toBeInTheDocument();
  });

  it("uses the existing preview fallback when a signed image fails", () => {
    render(<SellSubmissionsList submissions={[base]} />);

    fireEvent.error(screen.getByRole("img", { name: /photo 1/ }));

    expect(screen.getByText("Preview unavailable")).toBeInTheDocument();
  });

  it("says plainly when nothing has been sent, rather than showing an empty frame", () => {
    render(<SellSubmissionsList submissions={[]} />);

    expect(screen.getByText(/No customer has sent a car/)).toBeInTheDocument();
  });

  it("never renders a raw storage path", () => {
    const { container } = render(<SellSubmissionsList submissions={[base]} />);

    expect(container.textContent ?? "").not.toContain("storage_path");
  });
});
