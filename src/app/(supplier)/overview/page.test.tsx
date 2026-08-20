import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { mockGetOwnSupplierOverview, mockGetCurrentRole } = vi.hoisted(() => ({
  mockGetOwnSupplierOverview: vi.fn(),
  mockGetCurrentRole: vi.fn().mockResolvedValue("supplier"),
}));

vi.mock("@/server/supplier-overview", () => ({
  getOwnSupplierOverview: mockGetOwnSupplierOverview,
}));

vi.mock("@/app/auth/actions", () => ({
  getCurrentRole: mockGetCurrentRole,
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

import SupplierOverviewPage from "./page";

describe("SupplierOverviewPage (WS-A isolated overview)", () => {
  it("shows pending invite message when no supplier row", async () => {
    mockGetOwnSupplierOverview.mockResolvedValueOnce({
      supplier: null,
      documents: [],
      verification: { verifiedPrimary: 0, required: 2, total: 0 },
    });
    const ui = await SupplierOverviewPage();
    render(ui);
    expect(screen.getByText(/No supplier record — invite pending/)).toBeInTheDocument();
  });

  it("renders profile, verification progress and documents with message link", async () => {
    mockGetOwnSupplierOverview.mockResolvedValueOnce({
      supplier: {
        id: "sup-1",
        business_name: "Acme Supplies",
        supplier_kind: "company",
        state: "approved",
        contact_name: "Jane Doe",
        contact_email: "jane@acme.test",
        contact_phone: "09170000000",
        created_at: "2026-08-01T00:00:00.000Z",
        account_id: "user-1",
      },
      documents: [
        {
          id: "doc-1",
          supplier_id: "sup-1",
          document_kind: "passport",
          is_primary_id: true,
          storage_path: "sup-1/passport-1.pdf",
          verification_state: "verified",
          verified_at: "2026-08-02T00:00:00.000Z",
          created_at: "2026-08-01T00:00:00.000Z",
        },
        {
          id: "doc-2",
          supplier_id: "sup-1",
          document_kind: "drivers_license",
          is_primary_id: true,
          storage_path: "sup-1/license-1.pdf",
          verification_state: "pending",
          verified_at: null,
          created_at: "2026-08-01T00:00:00.000Z",
        },
      ],
      verification: { verifiedPrimary: 1, required: 2, total: 2 },
    });
    const ui = await SupplierOverviewPage();
    render(ui);
    expect(screen.getByText("Acme Supplies")).toBeInTheDocument();
    expect(screen.getByText(/1 of 2 primary IDs verified/)).toBeInTheDocument();
    expect(screen.getByText("passport")).toBeInTheDocument();
    expect(screen.getByText("drivers_license")).toBeInTheDocument();
    expect(screen.getAllByText("primary")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Open Messages" })).toHaveAttribute("href", "/supplier/supplier-messages");
  });
});
