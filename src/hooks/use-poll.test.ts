import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { usePoll } from "./use-poll";

function setHidden(hidden: boolean) {
  Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("usePoll", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setHidden(false);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("advances the cursor it hands to each poll", async () => {
    const poll = vi.fn(async (cursor: string | null) => `${cursor ?? ""}x`);
    renderHook(() => usePoll("c", poll, { intervalMs: 1000 }));
    await act(() => vi.advanceTimersByTimeAsync(1000));
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(poll.mock.calls.map(([c]) => c)).toEqual(["c", "cx"]);
  });

  it("never runs two polls at once", async () => {
    let release: (value: string) => void = () => undefined;
    const poll = vi.fn(() => new Promise<string>((resolve) => (release = resolve)));
    renderHook(() => usePoll(null, poll, { intervalMs: 1000 }));
    await act(() => vi.advanceTimersByTimeAsync(5000));
    expect(poll).toHaveBeenCalledTimes(1);
    await act(async () => release("next"));
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(poll).toHaveBeenCalledTimes(2);
  });

  it("pauses while hidden and polls at once when shown again", async () => {
    const poll = vi.fn(async () => null);
    renderHook(() => usePoll(null, poll, { intervalMs: 1000, hiddenIntervalMs: 0 }));
    act(() => setHidden(true));
    await act(() => vi.advanceTimersByTimeAsync(10_000));
    expect(poll).not.toHaveBeenCalled();
    await act(async () => setHidden(false));
    expect(poll).toHaveBeenCalledTimes(1);
  });

  it("backs off after a failure and keeps the old cursor", async () => {
    const poll = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue("after");
    renderHook(() => usePoll("start", poll, { intervalMs: 1000 }));
    await act(() => vi.advanceTimersByTimeAsync(1000));
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(poll).toHaveBeenCalledTimes(1); // waiting 2 s now
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(poll.mock.calls.map(([c]) => c)).toEqual(["start", "start"]);
  });

  it("stops when unmounted", async () => {
    const poll = vi.fn(async () => null);
    const { unmount } = renderHook(() => usePoll(null, poll, { intervalMs: 1000 }));
    unmount();
    await act(() => vi.advanceTimersByTimeAsync(5000));
    expect(poll).not.toHaveBeenCalled();
  });
});
