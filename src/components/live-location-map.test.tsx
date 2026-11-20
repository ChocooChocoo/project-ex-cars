import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getFieldCaseLocation } = vi.hoisted(() => ({ getFieldCaseLocation: vi.fn() }));

vi.mock("@/app/(staff)/field-cases/location-actions", () => ({ getFieldCaseLocation }));

import { LiveLocationMap } from "./live-location-map";

describe("LiveLocationMap", () => {
  beforeEach(() => {
    getFieldCaseLocation.mockResolvedValue({ success: true, lat: null, lng: null, at: null });
  });

  it("renders the map immediately from the initial point", () => {
    render(
      <LiveLocationMap fieldCaseId="case-1" initial={{ lat: 14.6, lng: 121.1, at: "2026-11-06T01:00:00.000Z" }} />,
    );
    expect(screen.getByTitle("Confidential Informant live location")).toBeInTheDocument();
    // SH-8: no external map redirect; the position stays on the in-app map.
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("14.60000, 121.10000")).toBeInTheDocument();
  });

  it("waits for a shared location before drawing the map", () => {
    getFieldCaseLocation.mockResolvedValue({ success: true, lat: null, lng: null, at: null });
    render(<LiveLocationMap fieldCaseId="case-1" initial={null} />);
    expect(screen.getByText(/Waiting for the Confidential Informant/)).toBeInTheDocument();
  });
});
