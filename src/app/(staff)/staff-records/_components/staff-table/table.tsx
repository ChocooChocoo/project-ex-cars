"use client";
"use no memo";

import * as React from "react";

import { useRouter } from "next/navigation";

import {
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type PaginationState,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table";
import {
  ArrowUpDown,
  BriefcaseBusiness,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";

import { saveStaffRecord, setAccountState } from "@/app/(staff)/staff-records/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { isStaffAccount, staffTableColumns, WORKDAYS } from "./columns";
import type { StaffTableRow } from "./schema";

export type { StaffTableRow };

const statusOptions = [
  { value: "all", label: "All" },
  { value: "active", label: "active" },
  { value: "suspended", label: "suspended" },
  { value: "archived", label: "archived" },
  { value: "invited", label: "invited" },
] as const;
const joinedDateOptions = [
  { value: "all", label: "All time" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
] as const;
const sortOptions = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "name-asc", label: "Name A-Z" },
  { value: "name-desc", label: "Name Z-A" },
] as const;

const STATE_OPTIONS = ["active", "suspended", "archived"] as const;

type SheetAction = "edit" | "status" | null;

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

export function StaffRecordsTable({ data }: { data: StaffTableRow[] }) {
  const router = useRouter();
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "joined", desc: true }]);
  const [columnVisibility] = React.useState<VisibilityState>({
    search: false,
    joinedWindow: false,
  });
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [selectedAccount, setSelectedAccount] = React.useState<StaffTableRow | null>(null);
  const [sheetAction, setSheetAction] = React.useState<SheetAction>(null);
  const [fullName, setFullName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [workdays, setWorkdays] = React.useState<number[]>([]);
  const [startTime, setStartTime] = React.useState("");
  const [endTime, setEndTime] = React.useState("");
  const [graceMinutes, setGraceMinutes] = React.useState("10");
  const [state, setState] = React.useState("active");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const openSheet = React.useCallback((account: StaffTableRow, action: Exclude<SheetAction, null>) => {
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

  const columns = React.useMemo(
    () =>
      staffTableColumns(
        (account) => openSheet(account, "edit"),
        (account) => openSheet(account, "status"),
      ),
    [openSheet],
  );

  const roleOptions = React.useMemo(() => {
    const roles = [...new Set(data.flatMap((row) => (row.role ? [row.role] : [])))].sort((a, b) => a.localeCompare(b));
    return [{ value: "all", label: "All" }, ...roles.map((role) => ({ value: role, label: role.replace(/_/g, " ") }))];
  }, [data]);

  const table = useReactTable({
    data,
    columns,
    state: {
      rowSelection,
      columnFilters,
      sorting,
      columnVisibility,
      pagination,
    },
    getRowId: (row) => row.id,
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const searchQuery = (table.getColumn("search")?.getFilterValue() as string) ?? "";
  const statusFilter = (table.getColumn("accountState")?.getFilterValue() as string) ?? "all";
  const roleFilter = (table.getColumn("role")?.getFilterValue() as string) ?? "all";
  const joinedDateFilter = (table.getColumn("joinedWindow")?.getFilterValue() as string) ?? "all";
  const sortValue = React.useMemo(() => {
    const currentSort = sorting[0];

    if (!currentSort) return "newest";
    if (currentSort.id === "joined" && currentSort.desc) return "newest";
    if (currentSort.id === "joined" && !currentSort.desc) return "oldest";
    if (currentSort.id === "name" && !currentSort.desc) return "name-asc";
    if (currentSort.id === "name" && currentSort.desc) return "name-desc";

    return "newest";
  }, [sorting]);

  function closeSheet(force = false) {
    if (saving && !force) return;
    setSheetAction(null);
    setSelectedAccount(null);
    setError(null);
  }

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
      <div className="space-y-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full lg:w-80">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-7 rounded-[min(var(--radius-md),12px)] pl-8"
                placeholder="Search staff..."
                value={searchQuery}
                onChange={(event) => {
                  table.getColumn("search")?.setFilterValue(event.target.value || undefined);
                  table.setPageIndex(0);
                }}
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <UsersRound />
                  Status
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-35" align="start">
                <DropdownMenuRadioGroup
                  value={statusFilter}
                  onValueChange={(value) => {
                    table.getColumn("accountState")?.setFilterValue(value === "all" ? undefined : value);
                    table.setPageIndex(0);
                  }}
                >
                  {statusOptions.map((status) => (
                    <DropdownMenuRadioItem key={status.value} value={status.value}>
                      {status.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <CalendarDays />
                  Joined date
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-40" align="start">
                <DropdownMenuRadioGroup
                  value={joinedDateFilter}
                  onValueChange={(value) => {
                    table.getColumn("joinedWindow")?.setFilterValue(value === "all" ? undefined : value);
                    table.setPageIndex(0);
                  }}
                >
                  {joinedDateOptions.map((option) => (
                    <DropdownMenuRadioItem key={option.value} value={option.value}>
                      {option.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center xl:w-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <BriefcaseBusiness />
                  Role
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuRadioGroup
                  value={roleFilter}
                  onValueChange={(value) => {
                    table.getColumn("role")?.setFilterValue(value === "all" ? undefined : value);
                    table.setPageIndex(0);
                  }}
                >
                  {roleOptions.map((role) => (
                    <DropdownMenuRadioItem key={role.value} value={role.value}>
                      {role.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <ArrowUpDown />
                  Sort
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuRadioGroup
                  value={sortValue}
                  onValueChange={(value) => {
                    const nextSorting: SortingState =
                      value === "oldest"
                        ? [{ id: "joined", desc: false }]
                        : value === "name-asc"
                          ? [{ id: "name", desc: false }]
                          : value === "name-desc"
                            ? [{ id: "name", desc: true }]
                            : [{ id: "joined", desc: true }];

                    table.setSorting(nextSorting);
                    table.setPageIndex(0);
                  }}
                >
                  {sortOptions.map((option) => (
                    <DropdownMenuRadioItem key={option.value} value={option.value}>
                      {option.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border bg-card">
          <Table>
            <TableHeader className="bg-muted/15">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} colSpan={header.colSpan} className="h-11 p-3 font-medium">
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="p-3 align-middle">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={table.getVisibleLeafColumns().length} className="h-24 text-center">
                    No results.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between px-1">
          <div className="hidden flex-1 text-muted-foreground text-sm lg:flex">
            {table.getFilteredSelectedRowModel().rows.length} of {table.getFilteredRowModel().rows.length} row(s)
            selected.
          </div>
          <div className="flex w-full items-center gap-8 lg:w-fit">
            <div className="hidden items-center gap-2 lg:flex">
              <Label htmlFor="staff-table-rows-per-page" className="font-medium text-sm">
                Rows per page
              </Label>
              <Select
                value={`${table.getState().pagination.pageSize}`}
                onValueChange={(value) => {
                  table.setPageSize(Number(value));
                }}
              >
                <SelectTrigger size="sm" className="w-20" id="staff-table-rows-per-page">
                  <SelectValue placeholder={table.getState().pagination.pageSize} />
                </SelectTrigger>
                <SelectContent side="top">
                  <SelectGroup>
                    {[10, 20, 30, 40, 50].map((pageSize) => (
                      <SelectItem key={pageSize} value={`${pageSize}`}>
                        {pageSize}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="flex w-fit items-center justify-center font-medium text-sm">
              Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
            </div>
            <div className="ml-auto flex items-center gap-2 lg:ml-0">
              <Button
                variant="outline"
                className="hidden size-8 lg:flex"
                size="icon"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Go to first page</span>
                <ChevronsLeft className="size-4" />
              </Button>
              <Button
                variant="outline"
                className="size-8"
                size="icon"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Go to previous page</span>
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="outline"
                className="size-8"
                size="icon"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Go to next page</span>
                <ChevronRight className="size-4" />
              </Button>
              <Button
                variant="outline"
                className="hidden size-8 lg:flex"
                size="icon"
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Go to last page</span>
                <ChevronsRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

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
