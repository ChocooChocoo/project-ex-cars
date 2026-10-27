import { useState } from "react";

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BrandModelCombobox } from "./brand-model-combobox";

function Harness({ initialBrand = "" }: { readonly initialBrand?: string }) {
  const [brand, setBrand] = useState(initialBrand);
  const [model, setModel] = useState("");
  return (
    <>
      <BrandModelCombobox
        idPrefix="test"
        brand={brand}
        model={model}
        onBrandChange={setBrand}
        onModelChange={setModel}
      />
      <output data-testid="values">{`${brand}|${model}`}</output>
    </>
  );
}

function type(label: string, text: string) {
  const input = screen.getByLabelText(label, { exact: false });
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: text } });
  fireEvent.keyDown(input, { key: "ArrowDown" });
  return input;
}

describe("BrandModelCombobox", () => {
  it("labels the fields Brand and Model", () => {
    render(<Harness />);
    expect(screen.getByLabelText("Brand", { exact: false })).toBeInTheDocument();
    expect(screen.getByLabelText("Model", { exact: false })).toBeInTheDocument();
  });

  it("suggests Toyota when the buyer types Toy", async () => {
    render(<Harness />);
    type("Brand", "Toy");
    const list = await screen.findByRole("listbox");
    expect(within(list).getByRole("option", { name: "Toyota" })).toBeInTheDocument();
    expect(within(list).queryByRole("option", { name: "Honda" })).not.toBeInTheDocument();
  });

  it("keeps a brand that is not in the list", () => {
    render(<Harness />);
    const input = type("Brand", "Zotye");
    fireEvent.blur(input);
    expect(screen.getByTestId("values")).toHaveTextContent("Zotye|");
    expect(input).toHaveValue("Zotye");
  });

  it("lists the chosen brand's models", async () => {
    render(<Harness initialBrand="Honda" />);
    type("Model", "");
    const list = await screen.findByRole("listbox");
    expect(within(list).getByRole("option", { name: "Civic" })).toBeInTheDocument();
    expect(within(list).queryByRole("option", { name: "Vios" })).not.toBeInTheDocument();
  });

  it("keeps a typed model that is not in the list", () => {
    render(<Harness initialBrand="Honda" />);
    const input = type("Model", "Jazz 2008");
    fireEvent.blur(input);
    expect(screen.getByTestId("values")).toHaveTextContent("Honda|Jazz 2008");
  });
});
