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
  Car,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Gauge,
  Plus,
  Search,
  Tag,
} from "lucide-react";
import { toast } from "sonner";

import { publishVehicle } from "@/app/(staff)/vehicles/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { VehicleFormSheet } from "./vehicle-form-sheet";
import { createColumns } from "./vehicles-columns";

const statusOptions = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "inspecting", label: "Inspecting" },
  { value: "repairing", label: "Repairing" },
  { value: "awaiting_price_approval", label: "Awaiting Approval" },
  { value: "available", label: "Available" },
  { value: "reserved", label: "Reserved" },
  { value: "sold", label: "Sold" },
  { value: "archived", label: "Archived" },
] as const;
const conditionOptions = [
  { value: "all", label: "All" },
  { value: "new", label: "New" },
  { value: "used", label: "Used" },
  { value: "certified", label: "Certified Pre-Owned" },
] as const;
const pricingTypeOptions = [
  { value: "all", label: "All" },
  { value: "negotiable", label: "Negotiable" },
  { value: "fixed", label: "Fixed" },
] as const;
const sortOptions = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "price-desc", label: "Price high to low" },
  { value: "price-asc", label: "Price low to high" },
] as const;

export function VehicleTable({
  vehicles,
  canManage,
}: {
  readonly vehicles: Record<string, unknown>[];
  readonly canManage: boolean;
}) {
  const router = useRouter();
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnVisibility] = React.useState<VisibilityState>({
    search: false,
    created_at: false,
  });
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [publishTarget, setPublishTarget] = React.useState<Record<string, unknown> | null>(null);
  const [publishing, setPublishing] = React.useState(false);
  const [formSheet, setFormSheet] = React.useState<{
    mode: "add" | "edit";
    vehicle: Record<string, unknown> | null;
  } | null>(null);

  async function handlePublish() {
    if (!publishTarget) return;
    setPublishing(true);
    const form = new FormData();
    form.set("id", publishTarget.id as string);
    const result = await publishVehicle(form);
    setPublishing(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Vehicle published");
    setPublishTarget(null);
    router.refresh();
  }

  const table = useReactTable({
    data: vehicles,
    columns: createColumns(
      (id: string) => {
        const vehicle = vehicles.find((v) => v.id === id);
        if (vehicle) setPublishTarget(vehicle);
      },
      (vehicle: Record<string, unknown>) => setFormSheet({ mode: "edit", vehicle }),
      canManage,
    ),
    state: {
      rowSelection,
      columnFilters,
      sorting,
      columnVisibility,
      pagination,
    },
    getRowId: (row) => row.id as string,
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
  const statusFilter = (table.getColumn("listing_state")?.getFilterValue() as string) ?? "all";
  const conditionFilter = (table.getColumn("condition")?.getFilterValue() as string) ?? "all";
  const pricingTypeFilter = (table.getColumn("pricing_type")?.getFilterValue() as string) ?? "all";
  const sortValue = React.useMemo(() => {
    const currentSort = sorting[0];

    if (!currentSort) return "newest";
    if (currentSort.id === "created_at" && currentSort.desc) return "newest";
    if (currentSort.id === "created_at" && !currentSort.desc) return "oldest";
    if (currentSort.id === "current_price" && currentSort.desc) return "price-desc";
    if (currentSort.id === "current_price" && !currentSort.desc) return "price-asc";

    return "newest";
  }, [sorting]);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="leading-none">{table.getFilteredRowModel().rows.length} Vehicles</CardTitle>
          <CardDescription>Vehicle listings with pricing and publishing status.</CardDescription>
          <CardAction>
            {canManage && (
              <Button variant="outline" size="sm" onClick={() => setFormSheet({ mode: "add", vehicle: null })}>
                <Plus />
                Add Vehicle
              </Button>
            )}
          </CardAction>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-full lg:w-80">
                  <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="h-7 rounded-[min(var(--radius-md),12px)] pl-8"
                    placeholder="Search vehicles..."
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
                      <Car />
                      Status
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-35" align="start">
                    <DropdownMenuRadioGroup
                      value={statusFilter}
                      onValueChange={(value) => {
                        table.getColumn("listing_state")?.setFilterValue(value === "all" ? undefined : value);
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
                      <Gauge />
                      Condition
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-35" align="start">
                    <DropdownMenuRadioGroup
                      value={conditionFilter}
                      onValueChange={(value) => {
                        table.getColumn("condition")?.setFilterValue(value === "all" ? undefined : value);
                        table.setPageIndex(0);
                      }}
                    >
                      {conditionOptions.map((condition) => (
                        <DropdownMenuRadioItem key={condition.value} value={condition.value}>
                          {condition.label}
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
                      <Tag />
                      Pricing
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuRadioGroup
                      value={pricingTypeFilter}
                      onValueChange={(value) => {
                        table.getColumn("pricing_type")?.setFilterValue(value === "all" ? undefined : value);
                        table.setPageIndex(0);
                      }}
                    >
                      {pricingTypeOptions.map((pricingType) => (
                        <DropdownMenuRadioItem key={pricingType.value} value={pricingType.value}>
                          {pricingType.label}
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
                            ? [{ id: "created_at", desc: false }]
                            : value === "price-desc"
                              ? [{ id: "current_price", desc: true }]
                              : value === "price-asc"
                                ? [{ id: "current_price", desc: false }]
                                : [{ id: "created_at", desc: true }];

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
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
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
                  <Label htmlFor="vehicles-rows-per-page" className="font-medium text-sm">
                    Rows per page
                  </Label>
                  <Select
                    value={`${table.getState().pagination.pageSize}`}
                    onValueChange={(value) => {
                      table.setPageSize(Number(value));
                    }}
                  >
                    <SelectTrigger size="sm" className="w-20" id="vehicles-rows-per-page">
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
        </CardContent>
      </Card>

      <AlertDialog
        open={publishTarget !== null}
        onOpenChange={(open) => {
          if (!open) setPublishTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish this vehicle?</AlertDialogTitle>
            <AlertDialogDescription>
              {publishTarget ? (
                <>
                  <span className="font-medium text-foreground">
                    {publishTarget.make as string} {publishTarget.model as string}
                  </span>{" "}
                  will be listed as available in the showroom. This cannot be undone.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handlePublish} disabled={publishing}>
              {publishing ? "Publishing..." : "Publish"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <VehicleFormSheet
        open={formSheet !== null}
        mode={formSheet?.mode ?? "add"}
        vehicle={formSheet?.vehicle ?? null}
        onOpenChange={(open) => {
          if (!open) setFormSheet(null);
        }}
      />
    </>
  );
}
