import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { usePageData } from "./use-page-data";

describe("usePageData", () => {
  it("loads once and never polls by default", async () => {
    vi.useFakeTimers();
    const loader = vi.fn(async () => "data");
    const { result } = renderHook(() => usePageData("k", loader));
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(result.current.data).toBe("data");
    await act(() => vi.advanceTimersByTimeAsync(120_000));
    expect(loader).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("reloads every refreshMs while mounted, and stops on unmount", async () => {
    vi.useFakeTimers();
    const loader = vi.fn(async () => "data");
    const { unmount } = renderHook(() => usePageData("k", loader, { refreshMs: 30_000 }));
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(loader).toHaveBeenCalledTimes(1);
    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(loader).toHaveBeenCalledTimes(2);
    unmount();
    await act(() => vi.advanceTimersByTimeAsync(120_000));
    expect(loader).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("does not start a poll while the previous load is still running", async () => {
    vi.useFakeTimers();
    let release: (value: string) => void = () => undefined;
    const loader = vi.fn(() => new Promise<string>((resolve) => (release = resolve)));
    renderHook(() => usePageData("k", loader, { refreshMs: 1000 }));
    await act(() => vi.advanceTimersByTimeAsync(3000));
    expect(loader).toHaveBeenCalledTimes(1);
    await act(async () => release("first"));
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(loader).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});

describe("usePageData polling defaults", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("keeps the caller's reload() working with no refreshMs", async () => {
    const loader = vi.fn(async () => "data");
    const { result } = renderHook(() => usePageData("k", loader));
    await act(() => vi.advanceTimersByTimeAsync(0));
    act(() => result.current.reload());
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(loader).toHaveBeenCalledTimes(2);
  });
});
