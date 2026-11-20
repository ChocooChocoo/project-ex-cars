import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { ShowroomGrid } from "./showroom-grid";

vi.mock("@/app/(staff)/vehicles/catalogue-actions", () => ({ toggleFavourite: vi.fn() }));

it("uses the cover image and keeps the existing icon for missing or failed images", () => {
  const photo = "https://api.global-exchange-car.online/storage/showroom-media/vios.png";
  render(
    <ShowroomGrid
      favouriteIds={[]}
      vehicles={[
        { id: "vios", make: "Toyota", model: "Vios", photo_url: photo },
        { id: "civic", make: "Honda", model: "Civic", photo_url: null },
      ]}
    />,
  );

  const vios = screen.getByRole("link", { name: /Toyota Vios/ });
  const civic = screen.getByRole("link", { name: /Honda Civic/ });
  const image = within(vios).getByRole("img", { name: "Toyota Vios" });
  expect(image).toHaveAttribute("src", photo);
  expect(within(civic).queryByRole("img")).not.toBeInTheDocument();
  expect(civic.querySelector(".lucide-car")).toBeInTheDocument();

  fireEvent.error(image);
  expect(within(vios).queryByRole("img")).not.toBeInTheDocument();
  expect(vios.querySelector(".lucide-car")).toBeInTheDocument();
});
