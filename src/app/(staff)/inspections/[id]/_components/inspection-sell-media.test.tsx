import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { InspectionSellMedia } from "./inspection-sell-media";

describe("InspectionSellMedia", () => {
  it("renders signed previews and resolved condition labels without private paths", () => {
    render(
      <InspectionSellMedia
        photos={[
          {
            id: "photo-1",
            is_image: true,
            signed_url: "https://storage.test/signed/sell-photo.jpg?token=secret",
          },
        ]}
        conditionItems={["Exterior scratches", "Brake wear"]}
      />,
    );

    expect(screen.getByText("Vehicle photos & condition")).toBeInTheDocument();
    expect(screen.getByText("1 photo")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Sell vehicle photo 1" })).toHaveAttribute(
      "src",
      "https://storage.test/signed/sell-photo.jpg?token=secret",
    );
    expect(screen.getByText("Exterior scratches")).toBeInTheDocument();
    expect(screen.getByText("Brake wear")).toBeInTheDocument();
    expect(screen.queryByText(/storage_path|transaction-1\/sell-photo/i)).not.toBeInTheDocument();
  });

  it("uses the existing image preview fallback when a signed image fails", () => {
    render(
      <InspectionSellMedia
        photos={[{ id: "photo-1", is_image: true, signed_url: "https://storage.test/signed/broken.jpg" }]}
        conditionItems={[]}
      />,
    );

    fireEvent.error(screen.getByRole("img", { name: "Sell vehicle photo 1" }));
    expect(screen.getByText("Preview unavailable")).toBeInTheDocument();
    expect(screen.getByText("No condition checklist submitted.")).toBeInTheDocument();
  });

  it("renders nothing when there are no photos or checklist items", () => {
    const { container } = render(<InspectionSellMedia photos={[]} conditionItems={[]} />);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText("Vehicle photos & condition")).not.toBeInTheDocument();
  });
});
