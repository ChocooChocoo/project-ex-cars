import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { saveStaffRecord, setAccountState } from "@/app/(staff)/staff-records/actions";

import type { StaffTableRow } from "./schema";
import { StaffRecordsTable } from "./table";

Element.prototype.hasPointerCapture = () => false;
Element.prototype.releasePointerCapture = () => undefined;
Element.prototype.setPointerCapture = () => undefined;
Element.prototype.scrollIntoView = () => undefined;

const { refreshMock, toastMock } = vi.hoisted(() => ({
  refreshMock: vi.fn(),
  toastMock: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

vi.mock("sonner", () => ({
  toast: toastMock,
}));

vi.mock("@/app/(staff)/staff-records/actions", () => ({
  saveStaffRecord: vi.fn(),
  setAccountState: vi.fn(),
}));

const saveStaffRecordMock = vi.mocked(saveStaffRecord);
const setAccountStateMock = vi.mocked(setAccountState);

const staffAccount: StaffTableRow = {
  id: "00000000-0000-4000-8000-000000000001",
  fullName: "Ada Staff",
  phone: "09170000000",
  address: "Manila",
  role: "mechanic",
  accountState: "active",
  joined: "2024-03-15T08:00:00.000Z",
  schedule: null,
  workdays: [1, 2, 3, 4, 5],
  startTime: "09:00",
  endTime: "18:00",
  graceMinutes: 10,
};

const outOfRangeStaffAccount: StaffTableRow = {
  ...staffAccount,
  id: "00000000-0000-4000-8000-000000000004",
  fullName: "Out of Range Staff",
  graceMinutes: 60,
};

const customerAccount: StaffTableRow = {
  id: "00000000-0000-4000-8000-000000000002",
  fullName: "Cora Customer",
  phone: null,
  address: null,
  role: "customer",
  accountState: "active",
  joined: "2024-01-05T08:00:00.000Z",
  schedule: null,
  workdays: null,
  startTime: null,
  endTime: null,
  graceMinutes: null,
};

const unassignedAccount: StaffTableRow = {
  id: "00000000-0000-4000-8000-000000000003",
  fullName: "Unassigned Account",
  phone: null,
  address: null,
  role: null,
  accountState: "active",
  joined: "2024-02-10T08:00:00.000Z",
  schedule: null,
  workdays: [1, 2, 3, 4, 5],
  startTime: "09:00",
  endTime: "18:00",
  graceMinutes: 10,
};

const suspendedAccount: StaffTableRow = {
  ...customerAccount,
  id: "00000000-0000-4000-8000-000000000005",
  fullName: "Zed Suspended",
  accountState: "suspended",
};

function renderTable(accounts = [staffAccount, customerAccount]) {
  return render(<StaffRecordsTable data={accounts} />);
}

function openDropdown(trigger: HTMLElement) {
  fireEvent.pointerDown(trigger);
  fireEvent.mouseDown(trigger, { button: 0 });
  fireEvent.mouseUp(trigger, { button: 0 });
  fireEvent.click(trigger);
}

function openActions(name: string) {
  openDropdown(screen.getByRole("button", { name: `More actions for ${name}` }));
}

describe("StaffRecordsTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders rows with name, role, status, and schedule", () => {
    renderTable([staffAccount]);

    expect(screen.getByText("Ada Staff")).toBeInTheDocument();
    expect(screen.getByText("mechanic")).toBeInTheDocument();
    expect(screen.getByText("active")).toBeInTheDocument();
    expect(screen.getByText("Mon, Tue, Wed, Thu, Fri · 09:00–18:00")).toBeInTheDocument();
  });

  it("renders an em dash for accounts without a schedule", () => {
    renderTable([customerAccount]);

    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("searches rows by name, role, and id, and clears the filter", () => {
    renderTable();

    const search = screen.getByPlaceholderText("Search staff...");
    fireEvent.change(search, { target: { value: "Cora" } });
    expect(screen.getByText("Cora Customer")).toBeInTheDocument();
    expect(screen.queryByText("Ada Staff")).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: "mechanic" } });
    expect(screen.getByText("Ada Staff")).toBeInTheDocument();
    expect(screen.queryByText("Cora Customer")).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: "00000002" } });
    expect(screen.getByText("Cora Customer")).toBeInTheDocument();
    expect(screen.queryByText("Ada Staff")).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: "" } });
    expect(screen.getByText("Ada Staff")).toBeInTheDocument();
    expect(screen.getByText("Cora Customer")).toBeInTheDocument();
  });

  it("filters rows by status", async () => {
    renderTable([staffAccount, suspendedAccount]);

    openDropdown(screen.getByRole("button", { name: "Status" }));
    fireEvent.click(await screen.findByRole("menuitemradio", { name: "suspended" }));

    expect(screen.getByText("Zed Suspended")).toBeInTheDocument();
    expect(screen.queryByText("Ada Staff")).not.toBeInTheDocument();
  });

  it("paginates with page buttons", () => {
    const accounts = Array.from({ length: 25 }, (_, index) => ({
      ...customerAccount,
      id: `00000000-0000-4000-8000-${String(index + 10).padStart(12, "0")}`,
      fullName: `Customer ${index + 1}`,
    }));
    renderTable(accounts);

    expect(screen.getByText("Customer 1")).toBeInTheDocument();
    expect(screen.queryByText("Customer 25")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Go to next page" }));
    expect(screen.getByText("Customer 11")).toBeInTheDocument();
    expect(screen.queryByText("Customer 1")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Go to last page" }));
    expect(screen.getByText("Customer 25")).toBeInTheDocument();
    expect(screen.getByText("Page 3 of 3")).toBeInTheDocument();
  });

  it("changes the rows per page size", async () => {
    const accounts = Array.from({ length: 25 }, (_, index) => ({
      ...customerAccount,
      id: `00000000-0000-4000-8000-${String(index + 10).padStart(12, "0")}`,
      fullName: `Customer ${index + 1}`,
    }));
    renderTable(accounts);

    const rowsPerPage = screen.getByLabelText("Rows per page");
    fireEvent.pointerDown(rowsPerPage);
    fireEvent.click(rowsPerPage);
    fireEvent.click(await screen.findByRole("option", { name: "20" }));

    expect(screen.getByText("Customer 20")).toBeInTheDocument();
    expect(screen.queryByText("Customer 21")).not.toBeInTheDocument();
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
  });

  it("targets the selected account when opening an action Sheet", async () => {
    renderTable();

    openActions("Cora Customer");
    fireEvent.click(await screen.findByRole("menuitem", { name: "Set Status" }));

    expect(await screen.findByRole("heading", { name: "Change Account Status" })).toBeInTheDocument();
    expect(screen.getByText("Cora Customer")).toBeInTheDocument();
  });

  it("shows schedule fields only when editing a staff account", async () => {
    renderTable();

    openActions("Ada Staff");
    fireEvent.click(await screen.findByRole("menuitem", { name: "Edit" }));
    expect(await screen.findByRole("group", { name: "Workdays" })).toBeInTheDocument();
    expect(screen.getByLabelText("Start time")).toHaveValue("09:00");
    expect(screen.getByLabelText("Grace minutes")).toHaveAttribute("min", "5");
    expect(screen.getByLabelText("Grace minutes")).toHaveAttribute("max", "10");

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    openActions("Cora Customer");
    fireEvent.click(await screen.findByRole("menuitem", { name: "Edit" }));
    expect(await screen.findByRole("heading", { name: "Edit Account" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Workdays" })).not.toBeInTheDocument();
  });

  it("clamps an out-of-range stored grace period when editing staff", async () => {
    renderTable([outOfRangeStaffAccount]);

    openActions("Out of Range Staff");
    fireEvent.click(await screen.findByRole("menuitem", { name: "Edit" }));

    const graceInput = await screen.findByLabelText("Grace minutes");
    expect(graceInput).toHaveValue(10);
    expect(graceInput).toHaveAttribute("min", "5");
    expect(graceInput).toHaveAttribute("max", "10");
  });

  it("keeps the edit Sheet open when saving fails", async () => {
    saveStaffRecordMock.mockResolvedValue({ error: "Could not save the account." });
    renderTable([staffAccount]);

    openActions("Ada Staff");
    fireEvent.click(await screen.findByRole("menuitem", { name: "Edit" }));
    fireEvent.click(await screen.findByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not save the account.");
    expect(screen.getByRole("heading", { name: "Edit Account" })).toBeInTheDocument();
  });

  it("omits schedule fields when saving a non-staff account", async () => {
    saveStaffRecordMock.mockResolvedValue({
      success: true,
      row: { id: customerAccount.id, account_state: "active" as const },
    });
    renderTable([customerAccount]);

    openActions("Cora Customer");
    fireEvent.click(await screen.findByRole("menuitem", { name: "Edit" }));
    fireEvent.click(await screen.findByRole("button", { name: "Save" }));

    await waitFor(() => expect(saveStaffRecordMock).toHaveBeenCalledTimes(1));
    const formData = saveStaffRecordMock.mock.calls[0]?.[0];
    expect(formData.get("accountId")).toBe(customerAccount.id);
    expect(formData.get("workdays")).toBeNull();
    expect(formData.get("startTime")).toBeNull();
    expect(formData.get("endTime")).toBeNull();
    expect(formData.get("graceMinutes")).toBeNull();
  });

  it("omits schedule fields for an unassigned account even when schedule data is present", async () => {
    saveStaffRecordMock.mockResolvedValue({
      success: true,
      row: { id: unassignedAccount.id, account_state: "active" as const },
    });
    renderTable([unassignedAccount]);

    openActions("Unassigned Account");
    fireEvent.click(await screen.findByRole("menuitem", { name: "Edit" }));
    expect(screen.queryByRole("group", { name: "Workdays" })).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "Save" }));

    await waitFor(() => expect(saveStaffRecordMock).toHaveBeenCalledTimes(1));
    const formData = saveStaffRecordMock.mock.calls[0]?.[0];
    expect(formData.get("accountId")).toBe(unassignedAccount.id);
    expect(formData.get("workdays")).toBeNull();
    expect(formData.get("startTime")).toBeNull();
    expect(formData.get("endTime")).toBeNull();
    expect(formData.get("graceMinutes")).toBeNull();
  });

  it("submits the edit Sheet and shows a toast on success", async () => {
    saveStaffRecordMock.mockResolvedValue({
      success: true,
      row: { id: staffAccount.id, account_state: "active" as const },
    });
    renderTable([staffAccount]);

    openActions("Ada Staff");
    fireEvent.click(await screen.findByRole("menuitem", { name: "Edit" }));
    fireEvent.click(await screen.findByRole("button", { name: "Save" }));

    await waitFor(() => expect(saveStaffRecordMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith("Account details updated."));
    expect(refreshMock).toHaveBeenCalled();
  });

  it("rejects a save response for the wrong account and keeps the edit Sheet open", async () => {
    saveStaffRecordMock.mockResolvedValue({
      success: true,
      row: { id: customerAccount.id, account_state: "active" as const },
    });
    renderTable([staffAccount]);

    openActions("Ada Staff");
    fireEvent.click(await screen.findByRole("menuitem", { name: "Edit" }));
    fireEvent.click(await screen.findByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("could not be verified");
    expect(screen.getByRole("heading", { name: "Edit Account" })).toBeInTheDocument();
  });

  it("rejects a status response with the wrong state and keeps the status Sheet open", async () => {
    setAccountStateMock.mockResolvedValue({
      success: true,
      row: { id: staffAccount.id, account_state: "active" },
    });
    renderTable([staffAccount]);

    openActions("Ada Staff");
    fireEvent.click(await screen.findByRole("menuitem", { name: "Set Status" }));
    fireEvent.click(await screen.findByRole("button", { name: "Change Status" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("could not be verified");
    expect(screen.getByRole("heading", { name: "Change Account Status" })).toBeInTheDocument();
  });

  it("keeps the edit Sheet open when the save action throws", async () => {
    saveStaffRecordMock.mockRejectedValue(new Error("Network unavailable"));
    renderTable([staffAccount]);

    openActions("Ada Staff");
    fireEvent.click(await screen.findByRole("menuitem", { name: "Edit" }));
    fireEvent.click(await screen.findByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Network unavailable");
    expect(screen.getByRole("heading", { name: "Edit Account" })).toBeInTheDocument();
  });

  it("keeps the status Sheet open when the status action throws", async () => {
    setAccountStateMock.mockRejectedValue(new Error("Status service unavailable"));
    renderTable([staffAccount]);

    openActions("Ada Staff");
    fireEvent.click(await screen.findByRole("menuitem", { name: "Set Status" }));
    fireEvent.click(await screen.findByRole("button", { name: "Change Status" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Status service unavailable");
    expect(screen.getByRole("heading", { name: "Change Account Status" })).toBeInTheDocument();
  });

  it("validates a successful status response before closing the Sheet", async () => {
    setAccountStateMock.mockResolvedValue({ success: true, row: { id: staffAccount.id, account_state: "suspended" } });
    renderTable([staffAccount]);

    openActions("Ada Staff");
    fireEvent.click(await screen.findByRole("menuitem", { name: "Set Status" }));
    fireEvent.click(await screen.findByRole("button", { name: "Change Status" }));

    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: "Change Account Status" })).not.toBeInTheDocument(),
    );
    expect(toastMock.success).toHaveBeenCalledWith("Account suspended.");
    expect(refreshMock).toHaveBeenCalled();
  });

  it("keeps action targeting stable after pagination", async () => {
    const accounts = Array.from({ length: 11 }, (_, index) => ({
      ...customerAccount,
      id: `00000000-0000-4000-8000-${String(index + 10).padStart(12, "0")}`,
      fullName: `Customer ${index + 1}`,
    }));
    renderTable(accounts);

    fireEvent.click(screen.getByRole("button", { name: "Go to next page" }));
    openActions("Customer 11");
    fireEvent.click(await screen.findByRole("menuitem", { name: "Edit" }));

    expect(await screen.findByDisplayValue("Customer 11")).toBeInTheDocument();
  });
});
