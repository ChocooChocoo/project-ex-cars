"use client";
"use no memo";

import { useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { Car, Plus, Search } from "lucide-react";
import { toast } from "sonner";

import { publishVehicle } from "@/app/(ceo)/vehicles/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { createColumns } from "./vehicles-columns";

export function VehicleTable({ vehicles }: { readonly vehicles: Record<string, unknown>[] }) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = vehicles.filter((v) => {
    if (statusFilter !== "all" && v.listing_state !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const stock = ((v.stock_code as string) ?? "").toLowerCase();
      const make = ((v.make as string) ?? "").toLowerCase();
      const model = ((v.model as string) ?? "").toLowerCase();
      if (!stock.includes(q) && !make.includes(q) && !model.includes(q)) return false;
    }
    return true;
  });

  const columns = createColumns((id: string) => {
    const form = new FormData();
    form.set("id", id);
    publishVehicle(form)
      .then((result) => {
        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success("Vehicle published");
          router.refresh();
        }
      })
      .catch(() => toast.error("Failed to publish vehicle"));
  });

  const table = useReactTable({
    data: filtered,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    state: { sorting, columnFilters },
    initialState: { pagination: { pageSize: 10 } },
  });

  const statuses = ["all", "draft", "available", "reserved", "sold", "archived"];

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>
          <div className="flex items-center gap-2">
            <Car className="size-5 text-muted-foreground" />
            {filtered.length} vehicles
          </div>
        </CardTitle>
        <div className="flex items-center gap-2">
          <InputGroup className="h-7 w-full md:w-64">
            <InputGroupAddon align="inline-start">
              <Search className="size-3.5" />
            </InputGroupAddon>
            <InputGroupInput
              placeholder="Search vehicles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <InputGroupAddon align="inline-end">
              <Kbd className="h-4 text-[10px]">⌘K</Kbd>
            </InputGroupAddon>
          </InputGroup>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger size="sm" className="w-36">
              <span className="text-muted-foreground">Status:</span>
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" align="start">
              <SelectGroup>
                {statuses.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s === "all" ? "All" : s.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Button asChild size="sm">
            <Link href="/dashboard/vehicles/new">
              <Plus className="size-4" />
              Add Vehicle
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} style={{ width: header.getSize() }}>
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length > 0 ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                    No vehicles found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-between border-t px-4 py-2">
          <div className="text-muted-foreground text-sm">
            {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}–
            {Math.min(
              (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
              table.getFilteredRowModel().rows.length,
            )}
            {" of "}
            {table.getFilteredRowModel().rows.length}
          </div>
          <Pagination className="w-fit">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious aria-disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()} />
              </PaginationItem>
              {Array.from({ length: table.getPageCount() }, (_, i) => {
                const pageKey = `page-${i}`;
                if (table.getPageCount() > 7 && i > 1 && i < table.getPageCount() - 2) {
                  if (i === 2) {
                    return (
                      <PaginationItem key={pageKey}>
                        <PaginationLink>...</PaginationLink>
                      </PaginationItem>
                    );
                  }
                  return null;
                }
                return (
                  <PaginationItem key={pageKey}>
                    <PaginationLink
                      isActive={table.getState().pagination.pageIndex === i}
                      onClick={() => table.setPageIndex(i)}
                    >
                      {i + 1}
                    </PaginationLink>
                  </PaginationItem>
                );
              })}
              <PaginationItem>
                <PaginationNext aria-disabled={!table.getCanNextPage()} onClick={() => table.nextPage()} />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </CardContent>
    </Card>
  );
}
