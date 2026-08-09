"use client";

import Link from "next/link";

import type { ColumnDef } from "@tanstack/react-table";
import { Eye, MoreHorizontal } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface InspectionRow {
  id: string;
  mechanic_id: string;
  condition_score: number | null;
  inspection_date: string;
  recommendation: string | null;
  vehicles: { make: string; model: string; year: number; stock_code: string } | null;
}

export const inspectionColumns: ColumnDef<InspectionRow>[] = [
  {
    id: "vehicle",
    header: "Vehicle",
    cell: ({ row }) => {
      const vehicle = row.original.vehicles;
      return (
        <div className="grid gap-0.5">
          <Link href={`/dashboard/inspections/${row.original.id}`} className="font-medium hover:text-primary">
            {vehicle ? `${vehicle.make} ${vehicle.model} (${vehicle.year})` : "—"}
          </Link>
          <span className="text-muted-foreground text-xs">{vehicle?.stock_code ?? "—"}</span>
        </div>
      );
    },
  },
  {
    accessorKey: "mechanic_id",
    header: "Mechanic",
    cell: ({ row }) => <span className="text-muted-foreground text-sm">{row.original.mechanic_id.slice(0, 8)}...</span>,
  },
  {
    accessorKey: "condition_score",
    header: "Condition Score",
    cell: ({ row }) => {
      const score = row.original.condition_score;
      if (score === null) return <span className="text-muted-foreground">—</span>;
      return <Badge variant={score >= 70 ? "default" : "secondary"}>{score}/100</Badge>;
    },
  },
  {
    accessorKey: "inspection_date",
    header: "Date",
    cell: ({ row }) => (
      <span className="text-muted-foreground text-sm">
        {new Date(row.original.inspection_date).toLocaleDateString()}
      </span>
    ),
  },
  {
    accessorKey: "recommendation",
    header: "Recommendation",
    cell: ({ row }) => (
      <span className="max-w-60 truncate text-muted-foreground text-sm">{row.original.recommendation ?? "—"}</span>
    ),
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8">
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/dashboard/inspections/${row.original.id}`}>
              <Eye className="mr-2 size-4" />
              View Details
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
];
