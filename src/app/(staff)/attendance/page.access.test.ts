import { describe, expect, it, vi } from "vitest";

const { requireRole } = vi.hoisted(() => ({ requireRole: vi.fn() }));
vi.mock("@/lib/auth/guards", () => ({ requireRole }));

import AttendancePage from "./page";

describe("Attendance route eligibility", () => {
  it("refuses Head Security at the route guard before loading attendance", async () => {
    requireRole.mockImplementation(async (roles: string[]) => {
      if (roles.includes("head_security")) throw new Error("Head Security was admitted");
      throw new Error("unauthorized");
    });
    await expect(AttendancePage()).rejects.toThrow("unauthorized");
    expect(requireRole).toHaveBeenCalledWith(expect.arrayContaining(["ceo", "account_manager", "mechanic"]));
  });
});
