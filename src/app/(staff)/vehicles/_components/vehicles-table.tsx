"use client";

import { useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  type ColumnFiltersState,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type PaginationState,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table";
import { Car, Plus, Search } from "lucide-react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { createColumns } from "./vehicles-columns";

const STATUS_OPTIONS = [
  "all",
  "draft",
  "inspecting",
  "repairing",
  "awaiting_price_approval",
  "available",
  "reserved",
  "sold",
  "archived",
];

export function VehicleTable({ vehicles }: { readonly vehicles: Record<string, unknown>[] }) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({ search: false });
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [publishTarget, setPublishTarget] = useState<Record<string, unknown> | null>(null);
  const [publishing, setPublishing] = useState(false);

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
    columns: createColumns((id: string) => {
      const vehicle = vehicles.find((v) => v.id === id);
      if (vehicle) setPublishTarget(vehicle);
    }),
    state: { sorting, columnFilters, columnVisibility, pagination },
    getRowId: (row) => row.id as string,
    autoResetPageIndex: false,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const searchQuery = (table.getColumn("search")?.getFilterValue() as string) ?? "";
  const statusFilter = (table.getColumn("listing_state")?.getFilterValue() as string) ?? "all";

  function setStatusFilter(value: string) {
    table.getColumn("listing_state")?.setFilterValue(value === "all" ? undefined : value);
    table.setPageIndex(0);
  }

  return (
    <>
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>
            <div className="flex items-center gap-2">
              <Car className="size-5 text-muted-foreground" />
              {table.getFilteredRowModel().rows.length} vehicles
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
                onChange={(event) => {
                  table.getColumn("search")?.setFilterValue(event.target.value || undefined);
                  table.setPageIndex(0);
                }}
              />
              <InputGroupAddon align="inline-end">
                <Kbd className="h-4 text-[10px]">⌘K</Kbd>
              </InputGroupAddon>
            </InputGroup>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger size="sm" className="w-40">
                <span className="text-muted-foreground">Status:</span>
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" align="start">
                <SelectGroup>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option === "all" ? "All" : option.replace(/_/g, " ")}
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
          <DataTable table={table} rowsPerPageId="vehicles-rows-per-page" />
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
    </>
  );
}
