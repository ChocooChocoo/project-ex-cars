import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DeliveryLastSeen } from "@/components/delivery-last-seen";

const { updateDeliveryLocation } = vi.hoisted(() => ({ updateDeliveryLocation: vi.fn() }));
vi.mock("@/app/(staff)/field-cases/delivery-actions", () => ({ updateDeliveryLocation }));

import { ShareLocation } from "./share-location";

type Success = (position: GeolocationPosition) => void;
type Failure = (error: GeolocationPositionError) => void;

let onPosition: Success = () => undefined;
let onError: Failure = () => undefined;
const clearWatch = vi.fn();

const position = (lat: number, lng: number) => ({ coords: { latitude: lat, longitude: lng } }) as GeolocationPosition;

beforeEach(() => {
  vi.clearAllMocks();
  updateDeliveryLocation.mockResolvedValue({ success: true });
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: {
      watchPosition: vi.fn((success: Success, failure: Failure) => {
        onPosition = success;
        onError = failure;
        return 7;
      }),
      clearWatch,
    },
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ShareLocation", () => {
  it("sends the position at most once a minute and stops when turned off", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    render(<ShareLocation fieldCaseId="case-1" />);
    fireEvent.click(screen.getByRole("switch", { name: "Share my location" }));

    await act(async () => onPosition(position(14.5995, 120.9842)));
    await act(async () => onPosition(position(14.6, 120.99)));
    expect(updateDeliveryLocation).toHaveBeenCalledTimes(1);
    expect(updateDeliveryLocation).toHaveBeenCalledWith("case-1", 14.5995, 120.9842);

    vi.setSystemTime(Date.now() + 61_000);
    await act(async () => onPosition(position(14.61, 121)));
    expect(updateDeliveryLocation).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole("switch", { name: "Share my location" }));
    expect(clearWatch).toHaveBeenCalledWith(7);
  });

  it("explains a denied permission and turns sharing off", async () => {
    render(<ShareLocation fieldCaseId="case-1" />);
    const toggle = screen.getByRole("switch", { name: "Share my location" });
    fireEvent.click(toggle);

    act(() => onError({ code: 1, PERMISSION_DENIED: 1 } as GeolocationPositionError));
    expect(screen.getByRole("alert")).toHaveTextContent("Location access is blocked.");
    await waitFor(() => expect(toggle).toHaveAttribute("aria-checked", "false"));
    expect(updateDeliveryLocation).not.toHaveBeenCalled();
  });
});

describe("DeliveryLastSeen", () => {
  it("links the last position to Google Maps", () => {
    render(<DeliveryLastSeen lat={14.5995} lng={120.9842} at="2026-10-27T02:00:00.000Z" />);
    expect(screen.getByText(/Last seen/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open in Google Maps" })).toHaveAttribute(
      "href",
      "https://www.google.com/maps?q=14.5995,120.9842",
    );
  });

  it("shows nothing before a position is shared", () => {
    const { container } = render(<DeliveryLastSeen lat={null} lng={null} at={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
