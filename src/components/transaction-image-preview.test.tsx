import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { TransactionImagePreview } from "./transaction-image-preview";

afterEach(cleanup);

const src = "https://project.supabase.co/storage/v1/object/sign/transaction-documents/car.jpg?token=example";

describe("TransactionImagePreview", () => {
  it("loads a lazy thumbnail instead of the original image", () => {
    render(<TransactionImagePreview src={src} alt="Vehicle photo" />);

    const thumbnail = screen.getByRole("img", { name: "Vehicle photo" });
    const thumbnailUrl = new URL(thumbnail.getAttribute("src") ?? "", window.location.origin);
    expect(thumbnailUrl.pathname).toBe("/api/transaction-thumbnail");
    expect(thumbnailUrl.searchParams.get("src")).toBe(src);
    expect(thumbnail).toHaveAttribute("loading", "lazy");
    expect(thumbnail).toHaveAttribute("decoding", "async");
    expect(document.querySelector(`img[src="${src}"]`)).not.toBeInTheDocument();
  });

  it("mounts the original only while the enlarged view is open", () => {
    render(<TransactionImagePreview src={src} alt="Vehicle photo" />);

    fireEvent.click(screen.getByRole("button", { name: "Open Vehicle photo in a larger view" }));
    const dialog = screen.getByRole("dialog", { name: "Vehicle photo" });
    expect(within(dialog).getByRole("img")).toHaveAttribute("src", src);

    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(document.querySelector(`img[src="${src}"]`)).not.toBeInTheDocument();
  });

  it("still lets the user open the original if thumbnail generation fails", () => {
    render(<TransactionImagePreview src={src} alt="Vehicle photo" />);

    fireEvent.error(screen.getByRole("img", { name: "Vehicle photo" }));
    expect(screen.getByText("Preview unavailable")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open Vehicle photo in a larger view" }));
    expect(within(screen.getByRole("dialog")).getByRole("img")).toHaveAttribute("src", src);
  });
});
