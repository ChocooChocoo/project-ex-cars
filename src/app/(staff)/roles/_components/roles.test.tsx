import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RBAC_MANAGED_ROLES } from "@/lib/auth/roles";

import { type RbacPermission, type RbacRole, Roles } from "./roles";

const { createRbacRole, createRbacPermission, updateRbacRole } = vi.hoisted(() => ({
  createRbacRole: vi.fn(),
  createRbacPermission: vi.fn(),
  updateRbacRole: vi.fn(),
}));

vi.mock("../actions", () => ({ createRbacRole, createRbacPermission, updateRbacRole }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));

globalThis.ResizeObserver = class {
  observe() {
    return;
  }
  unobserve() {
    return;
  }
  disconnect() {
    return;
  }
};

const areas = [
  { key: "dashboard", label: "Dashboard", sortOrder: 1 },
  { key: "vehicles", label: "Vehicles", sortOrder: 2 },
];
const actions = [
  { key: "read", label: "Read", sortOrder: 1 },
  { key: "update", label: "Update", sortOrder: 2 },
];
const permissions: RbacPermission[] = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    accessAreaKey: "dashboard",
    actionKey: "read",
    accessLabel: "Read Dashboard",
    permissionKey: "dashboard.read",
    description: "View the dashboard",
    status: "active",
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    accessAreaKey: "vehicles",
    actionKey: "update",
    accessLabel: "Update Vehicles",
    permissionKey: "vehicles.update",
    description: "Update vehicles",
    status: "active",
  },
  {
    id: "00000000-0000-4000-8000-000000000003",
    accessAreaKey: "vehicles",
    actionKey: "read",
    accessLabel: "Read Vehicles",
    permissionKey: "vehicles.read",
    description: "Read vehicles",
    status: "inactive",
  },
];
const roles: RbacRole[] = [
  {
    roleKey: "supplier",
    description: "Supplier access",
    status: "active",
    isProtected: false,
    permissionIds: [permissions[0].id],
  },
];

function renderRoles() {
  return render(<Roles roles={roles} permissions={permissions} accessAreas={areas} actions={actions} users={[]} />);
}

describe("Roles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createRbacRole.mockResolvedValue({ success: true });
    createRbacPermission.mockResolvedValue({ success: true });
    updateRbacRole.mockResolvedValue({ success: true });
  });

  it("renders exactly Roles and Permission tabs", () => {
    renderRoles();
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["Roles", "Permission"]);
    expect(screen.queryByText("Permission sets")).not.toBeInTheDocument();
    expect(screen.queryByText("Access reviews")).not.toBeInTheDocument();
  });

  it("offers the eight managed role choices and locks the canonical key", () => {
    renderRoles();
    fireEvent.click(screen.getByRole("button", { name: /create role/i }));
    const roleSelect = screen.getByLabelText("Role Label");
    expect(Array.from((roleSelect as HTMLSelectElement).options).map((option) => option.value)).toEqual([
      "",
      ...RBAC_MANAGED_ROLES.filter((key) => key !== "supplier"),
    ]);
    fireEvent.change(roleSelect, { target: { value: "account_manager" } });
    expect(screen.getByLabelText("System Role Key")).toHaveValue("account_manager");
    expect(screen.getByLabelText("System Role Key")).toHaveAttribute("readonly");
  });

  it("disables role creation when all canonical roles are already seeded", () => {
    render(
      <Roles
        roles={RBAC_MANAGED_ROLES.map((roleKey) => ({
          roleKey,
          description: "Seeded role",
          status: "active",
          isProtected: true,
          permissionIds: [],
        }))}
        permissions={permissions}
        accessAreas={areas}
        actions={actions}
        users={[]}
      />,
    );

    expect(screen.getByRole("button", { name: /create role/i })).toBeDisabled();
  });

  it("previews generated permission label and key and groups role assignments", () => {
    renderRoles();
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Permission" }), { button: 0 });
    fireEvent.click(screen.getByRole("tab", { name: "Permission" }));
    fireEvent.click(screen.getByRole("button", { name: /add permission/i }));
    fireEvent.change(screen.getByLabelText("Access Area"), { target: { value: "vehicles" } });
    fireEvent.change(screen.getByLabelText("Allowed Action"), { target: { value: "update" } });
    expect(screen.getByLabelText("Access Label Preview")).toHaveValue("Update Vehicles");
    expect(screen.getByLabelText("System Permission Key")).toHaveValue("vehicles.update");

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Roles" }), { button: 0 });
    fireEvent.click(screen.getByRole("tab", { name: "Roles" }));
    fireEvent.click(screen.getByRole("button", { name: /edit supplier/i }));
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText(/1 of 1 assigned/)).toBeInTheDocument();
    expect(screen.getByLabelText("Select all Dashboard permissions")).toBeChecked();
    expect(screen.getByLabelText("Select all Vehicles permissions")).not.toBeChecked();
  });

  it("keeps role descriptions in the edit dialog and gives it room for permission details", () => {
    render(
      <Roles
        roles={[
          {
            ...roles[0],
            description: "Manages accounts, suppliers, staff records, inquiries, requests, and payroll preparation.",
          },
        ]}
        permissions={permissions}
        accessAreas={areas}
        actions={actions}
        users={[]}
      />,
    );

    expect(screen.queryByText(/Manages accounts, suppliers/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /edit supplier/i }));
    expect(screen.getByRole("dialog")).toHaveClass("max-w-5xl");
    expect(screen.getByLabelText("Description")).toHaveValue(
      "Manages accounts, suppliers, staff records, inquiries, requests, and payroll preparation.",
    );
    expect(screen.getByRole("combobox", { name: "Status" })).toHaveAttribute("data-slot", "select-trigger");
    expect(screen.getByText("Read Dashboard").closest("[data-slot='label']")).toHaveClass("flex-col");
  });

  it("hides user assignments and the role table description column", () => {
    renderRoles();

    expect(screen.queryByRole("heading", { name: "User role assignments" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Description" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /edit supplier/i })).toBeInTheDocument();
  });
});
