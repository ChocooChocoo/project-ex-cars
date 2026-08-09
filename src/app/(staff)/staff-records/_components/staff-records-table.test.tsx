import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { saveStaffRecord, setAccountState } from "@/app/(staff)/staff-records/actions";

import { type StaffRecordAccount, StaffRecordsTable } from "./staff-records-table";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/app/(staff)/staff-records/actions", () => ({
  saveStaffRecord: vi.fn(),
  setAccountState: vi.fn(),
}));

const saveStaffRecordMock = vi.mocked(saveStaffRecord);
const setAccountStateMock = vi.mocked(setAccountState);

const staffAccount: StaffRecordAccount = {
  id: "00000000-0000-4000-8000-000000000001",
  fullName: "Ada Staff",
  phone: "09170000000",
  address: "Manila",
  role: "mechanic",
  accountState: "active",
  workdays: [1, 2, 3, 4, 5],
  startTime: "09:00",
  endTime: "18:00",
  graceMinutes: 10,
};

const outOfRangeStaffAccount: StaffRecordAccount = {
  ...staffAccount,
  id: "00000000-0000-4000-8000-000000000004",
  fullName: "Out of Range Staff",
  graceMinutes: 60,
};

const customerAccount: StaffRecordAccount = {
  id: "00000000-0000-4000-8000-000000000002",
  fullName: "Cora Customer",
  phone: null,
  address: null,
  role: "customer",
  accountState: "active",
  workdays: null,
  startTime: null,
  endTime: null,
  graceMinutes: null,
};

const unassignedAccount: StaffRecordAccount = {
  id: "00000000-0000-4000-8000-000000000003",
  fullName: "Unassigned Account",
  phone: null,
  address: null,
  role: null,
  accountState: "active",
  workdays: [1, 2, 3, 4, 5],
  startTime: "09:00",
  endTime: "18:00",
  graceMinutes: 10,
};

function renderTable(accounts = [staffAccount, customerAccount]) {
  return render(<StaffRecordsTable accounts={accounts} />);
}

function openActions(name: string) {
  const trigger = screen.getByRole("button", { name: `More actions for ${name}` });
  fireEvent.pointerDown(trigger);
  fireEvent.mouseDown(trigger, { button: 0 });
  fireEvent.mouseUp(trigger, { button: 0 });
  fireEvent.click(trigger);
}

describe("StaffRecordsTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
