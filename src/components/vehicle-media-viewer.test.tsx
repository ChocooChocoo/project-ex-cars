import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { frameAt, type VehicleMediaItem, VehicleMediaViewer } from "./vehicle-media-viewer";

const item = (id: string, media_kind: VehicleMediaItem["media_kind"], display_order = 0): VehicleMediaItem => ({
  id,
  media_kind,
  storage_path: `veh/${id}.jpg`,
  display_order,
});

const imageSrcs = () => screen.getAllByRole("presentation").map((img) => img.getAttribute("src") ?? "");

describe("VehicleMediaViewer", () => {
  it("shows no Interior tab when the car has no interior photos", () => {
    render(<VehicleMediaViewer media={[item("p1", "photo"), item("p2", "photo")]} />);

    expect(screen.queryByRole("button", { name: "Interior" })).not.toBeInTheDocument();
  });

  it("adds an Interior tab next to Gallery and shows only interior photos in it", () => {
    render(<VehicleMediaViewer media={[item("p1", "photo"), item("i1", "interior"), item("i2", "interior", 1)]} />);

    expect(screen.getByRole("button", { name: "Gallery" })).toHaveAttribute("aria-pressed", "true");
    expect(imageSrcs()[0]).toContain("veh/p1.jpg");

    fireEvent.click(screen.getByRole("button", { name: "Interior" }));

    expect(screen.getByRole("button", { name: "Interior" })).toHaveAttribute("aria-pressed", "true");
    expect(imageSrcs()[0]).toContain("veh/i1.jpg");
    fireEvent.click(screen.getByRole("button", { name: "Next photo" }));
    expect(imageSrcs()[0]).toContain("veh/i2.jpg");
  });

  it("keeps interior photos out of the gallery", () => {
    render(<VehicleMediaViewer media={[item("p1", "photo"), item("i1", "interior")]} />);

    // One gallery photo, so no carousel arrows: the interior photo is not counted in it.
    expect(imageSrcs()[0]).toContain("veh/p1.jpg");
    expect(screen.queryByRole("button", { name: "Next photo" })).not.toBeInTheDocument();
  });

  it("offers 360, Gallery and Interior together", () => {
    const spin = [item("s1", "360_view", 0), item("s2", "360_view", 1), item("s3", "360_view", 2)];
    render(<VehicleMediaViewer media={[...spin, item("p1", "photo"), item("i1", "interior")]} />);

    for (const name of ["360°", "Gallery", "Interior"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });

  it("opens on the interior photos when they are the only media", () => {
    render(<VehicleMediaViewer media={[item("i1", "interior")]} />);

    expect(imageSrcs()[0]).toContain("veh/i1.jpg");
    expect(screen.queryByRole("button", { name: "Interior" })).not.toBeInTheDocument();
  });

  it("mounts every 360 frame up front so rotating never waits on a download", () => {
    const spin = [0, 1, 2, 3].map((n) => item(`s${n}`, "360_view", n));
    render(<VehicleMediaViewer media={spin} />);

    const srcs = imageSrcs();
    expect(srcs).toHaveLength(4);
    for (const n of [0, 1, 2, 3]) expect(srcs.some((src) => src.includes(`veh/s${n}.jpg`))).toBe(true);
  });
});

describe("frameAt", () => {
  it("snaps to the nearest whole frame, with no blend between frames", () => {
    expect(frameAt(2, 8)).toBe(2);
    expect(frameAt(2.4, 8)).toBe(2);
    expect(frameAt(2.6, 8)).toBe(3);
  });

  it("wraps from the last frame back to the first", () => {
    expect(frameAt(7.6, 8)).toBe(0);
    expect(frameAt(17, 8)).toBe(1);
  });

  it("handles rotating backwards past zero", () => {
    expect(frameAt(-1, 8)).toBe(7);
    expect(frameAt(-0.6, 8)).toBe(7);
  });
});
