import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { GceLocationMap, MeetupMap } from "./lazy-maps";

// The unit tests run in jsdom, where Leaflet cannot mount a real map. These wrappers must therefore only ever
// load the map modules after a client render, keeping `leaflet` out of the test's import graph (T12 rule).
describe("lazy map wrappers", () => {
  it("renders a placeholder without importing Leaflet", () => {
    render(<MeetupMap />);
    expect(screen.queryByLabelText("Meet-up point map")).not.toBeInTheDocument();
    expect(document.querySelector(".animate-pulse")).not.toBeNull();
  });

  it("renders the GCE map placeholder without importing Leaflet", () => {
    render(<GceLocationMap />);
    expect(screen.queryByLabelText("GCE location map")).not.toBeInTheDocument();
  });
});
