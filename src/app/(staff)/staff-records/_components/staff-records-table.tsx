"use client";
"use no memo";

import { useCallback, useMemo, useState } from "react";

import { useRouter } from "next/navigation";

import {
  type ColumnDef,
  getCoreRowModel,
  getPaginationRowModel,
  type PaginationState,
  useReactTable,
} from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";

import { saveStaffRecord, setAccountState } from "@/app/(staff)/staff-records/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable } from "@/components/ui/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { STAFF_ROLES } from "@/lib/auth/roles";

export interface StaffRecordAccount {
  id: string;
  fullName: string | null;
  phone: string | null;
  address: string | null;
  role: string | null;
  accountState: string;
  workdays: number[] | null;
  startTime: string | null;
  endTime: string | null;
  graceMinutes: number | null;
}

type SheetAction = "edit" | "status" | null;

const STATE_OPTIONS = ["active", "suspended", "archived"] as const;
const WORKDAYS = [
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
  { value: 7, label: "Sunday", short: "Sun" },
] as const;

function isStaffAccount(account: StaffRecordAccount) {
  return (STAFF_ROLES as readonly string[]).includes(account.role ?? "");
}

function formatSchedule(account: StaffRecordAccount) {
  if (!isStaffAccount(account) || !account.startTime || !account.endTime) return "—";
  const days = WORKDAYS.filter((day) => account.workdays?.includes(day.value))
    .map((day) => day.short)
    .join(", ");
  return `${days || "No workdays"} · ${account.startTime}–${account.endTime}`;
}

function hasVerifiedRow(result: unknown, accountId: string, state?: string) {
  if (
    !result ||
    typeof result !== "object" ||
    !("success" in result) ||
    result.success !== true ||
    !("row" in result)
  ) {
    return false;
  }
  const row = result.row;
  if (!row || typeof row !== "object" || !("id" in row) || row.id !== accountId) return false;
  return state === undefined || ("account_state" in row && row.account_state === state);
}

export function StaffRecordsTable({ accounts }: { readonly accounts: StaffRecordAccount[] }) {
  const router = useRouter();
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [selectedAccount, setSelectedAccount] = useState<StaffRecordAccount | null>(null);
  const [sheetAction, setSheetAction] = useState<SheetAction>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [workdays, setWorkdays] = useState<number[]>([]);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [graceMinutes, setGraceMinutes] = useState("10");
  const [state, setState] = useState("active");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const openSheet = useCallback((account: StaffRecordAccount, action: Exclude<SheetAction, null>) => {
    setSelectedAccount(account);
    setSheetAction(action);
    setError(null);
    setFullName(account.fullName ?? "");
    setPhone(account.phone ?? "");
    setAddress(account.address ?? "");
    setWorkdays(account.workdays ?? []);
    setStartTime(account.startTime ?? "");
    setEndTime(account.endTime ?? "");
    setGraceMinutes(`${Math.min(10, Math.max(5, account.graceMinutes ?? 10))}`);
    setState(account.accountState === "active" ? "suspended" : "active");
  }, []);

  function closeSheet(force = false) {
    if (saving && !force) return;
    setSheetAction(null);
    setSelectedAccount(null);
    setError(null);
  }

  const columns = useMemo<ColumnDef<StaffRecordAccount>[]>(
    () => [
      {
        accessorKey: "fullName",
        header: "Name",
        cell: ({ row }) => <span className="font-medium">{row.original.fullName ?? "Unnamed account"}</span>,
      },
      {
        accessorKey: "role",
        header: "Role",
        cell: ({ row }) => <Badge variant="secondary">{row.original.role?.replace(/_/g, " ") ?? "Unassigned"}</Badge>,
      },
      {
        id: "schedule",
        header: "Schedule",
        cell: ({ row }) => <span className="text-muted-foreground text-sm">{formatSchedule(row.original)}</span>,
      },
      {
        accessorKey: "accountState",
        header: "Status",
        cell: ({ row }) => (
          <Badge variant={row.original.accountState === "active" ? "default" : "outline"}>
            {row.original.accountState}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => {
          const account = row.original;
          const name = account.fullName ?? "this account";
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8" aria-label={`More actions for ${name}`}>
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => openSheet(account, "edit")}>Edit</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => openSheet(account, "status")}>Set Status</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [openSheet],
  );

  const table = useReactTable({
    data: accounts,
    columns,
    state: { pagination },
    getRowId: (row) => row.id,
    autoResetPageIndex: false,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  async function saveDetails() {
    if (!selectedAccount) return;
    if (!fullName.trim()) {
      setError("Full name is required.");
      return;
    }

    const formData = new FormData();
    formData.set("accountId", selectedAccount.id);
    formData.set("fullName", fullName.trim());
    formData.set("phone", phone.trim());
    formData.set("address", address.trim());
    if (isStaffAccount(selectedAccount)) {
      formData.set("workdays", workdays.join(","));
      formData.set("startTime", startTime);
      formData.set("endTime", endTime);
      formData.set("graceMinutes", graceMinutes);
    }

    setSaving(true);
    setError(null);
    try {
      const result = await saveStaffRecord(formData);
      if (!hasVerifiedRow(result, selectedAccount.id)) {
        setError("error" in result ? result.error : "The saved account could not be verified.");
        return;
      }
      toast.success("Account details updated.");
      setSaving(false);
      closeSheet(true);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the account.");
    } finally {
      setSaving(false);
    }
  }

  async function saveState() {
    if (!selectedAccount) return;

    const formData = new FormData();
    formData.set("accountId", selectedAccount.id);
    formData.set("state", state);
    setSaving(true);
    setError(null);
    try {
      const result = await setAccountState(formData);
      if (!hasVerifiedRow(result, selectedAccount.id, state)) {
        setError("error" in result ? result.error : "The saved account could not be verified.");
        return;
      }
      toast.success(`Account ${state}.`);
      setSaving(false);
      closeSheet(true);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not change the account status.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <DataTable table={table} rowsPerPageId="staff-records-rows-per-page" />

      <Sheet open={sheetAction !== null} onOpenChange={(open) => !open && closeSheet()}>
        <SheetContent side="right">
          {sheetAction === "edit" && selectedAccount ? (
            <>
              <SheetHeader>
                <SheetTitle>Edit Account</SheetTitle>
                <SheetDescription>
                  Update the profile for {selectedAccount.fullName ?? "this account"}.
                </SheetDescription>
              </SheetHeader>
              <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="staff-record-full-name">Full name</Label>
                  <Input
                    id="staff-record-full-name"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="staff-record-phone">Phone</Label>
                  <Input id="staff-record-phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="staff-record-address">Address</Label>
                  <Input
                    id="staff-record-address"
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                  />
                </div>
                {isStaffAccount(selectedAccount) ? (
                  <>
                    <fieldset className="flex flex-col gap-2">
                      <legend className="font-medium text-sm">Workdays</legend>
                      <div className="grid grid-cols-2 gap-2">
                        {WORKDAYS.map((day) => (
                          <Label key={day.value} className="flex items-center gap-2 font-normal">
                            <Checkbox
                              checked={workdays.includes(day.value)}
                              onCheckedChange={(checked) =>
                                setWorkdays((current) =>
                                  checked
                                    ? [...current, day.value].sort((a, b) => a - b)
                                    : current.filter((value) => value !== day.value),
                                )
                              }
                            />
                            {day.label}
                          </Label>
                        ))}
                      </div>
                    </fieldset>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="staff-record-start-time">Start time</Label>
                        <Input
                          id="staff-record-start-time"
                          type="time"
                          value={startTime}
                          onChange={(event) => setStartTime(event.target.value)}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="staff-record-end-time">End time</Label>
                        <Input
                          id="staff-record-end-time"
                          type="time"
                          value={endTime}
                          onChange={(event) => setEndTime(event.target.value)}
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="staff-record-grace-minutes">Grace minutes</Label>
                      <Input
                        id="staff-record-grace-minutes"
                        type="number"
                        min="5"
                        max="10"
                        value={graceMinutes}
                        onChange={(event) => setGraceMinutes(event.target.value)}
                      />
                    </div>
                  </>
                ) : null}
                {error ? (
                  <p role="alert" className="text-destructive text-sm">
                    {error}
                  </p>
                ) : null}
              </div>
              <SheetFooter>
                <Button variant="ghost" onClick={() => closeSheet()} disabled={saving}>
                  Cancel
                </Button>
                <Button onClick={saveDetails} disabled={saving}>
                  {saving ? "Saving..." : "Save"}
                </Button>
              </SheetFooter>
            </>
          ) : null}

          {sheetAction === "status" && selectedAccount ? (
            <>
              <SheetHeader>
                <SheetTitle>Change Account Status</SheetTitle>
                <SheetDescription>
                  Update the sign-in status for {selectedAccount.fullName ?? "this account"}.
                </SheetDescription>
              </SheetHeader>
              <div className="flex flex-1 flex-col gap-4 px-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="staff-record-account-state">New status</Label>
                  <Select value={state} onValueChange={setState}>
                    <SelectTrigger id="staff-record-account-state">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATE_OPTIONS.filter((option) => option !== selectedAccount.accountState).map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-muted-foreground text-sm">Current status: {selectedAccount.accountState}.</p>
                {error ? (
                  <p role="alert" className="text-destructive text-sm">
                    {error}
                  </p>
                ) : null}
              </div>
              <SheetFooter>
                <Button variant="ghost" onClick={() => closeSheet()} disabled={saving}>
                  Cancel
                </Button>
                <Button onClick={saveState} disabled={saving}>
                  {saving ? "Saving..." : "Change Status"}
                </Button>
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
