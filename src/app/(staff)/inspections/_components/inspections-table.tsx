"use client";

import { useState } from "react";

import {
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type PaginationState,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { ClipboardList } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";

import { type InspectionRow, inspectionColumns } from "./inspections-columns";

export function InspectionsTable({ inspections }: { readonly inspections: InspectionRow[] }) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "inspection_date", desc: true }]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });

  const table = useReactTable({
    data: inspections,
    columns: inspectionColumns,
    state: { sorting, pagination },
    getRowId: (row) => row.id,
    autoResetPageIndex: false,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>
          <div className="flex items-center gap-2">
            <ClipboardList className="size-5 text-muted-foreground" />
            {inspections.length} inspections
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <DataTable table={table} rowsPerPageId="inspections-rows-per-page" />
      </CardContent>
    </Card>
  );
}
