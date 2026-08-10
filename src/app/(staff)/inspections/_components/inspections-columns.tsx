"use client";
"use no memo";

import Link from "next/link";

import type { ColumnDef } from "@tanstack/react-table";
import { differenceInCalendarDays, endOfToday, format, parseISO } from "date-fns";
import {
  Car,
  CarFront,
  CircleAlertIcon,
  CircleCheckIcon,
  CircleXIcon,
  Clock3Icon,
  Eye,
  MoreHorizontal,
  Printer,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface InspectionRow {
  id: string;
  vehicle_id: string;
  mechanic_id: string;
  condition_score: number | null;
  inspection_date: string;
  recommendation: string | null;
  vehicles: { make: string; model: string; year: number; stock_code: string } | null;
}

function recommendationIcon(recommendation: string | null) {
  if (recommendation === null) return <Clock3Icon className="size-3.5 text-muted-foreground" />;

  const lower = recommendation.toLowerCase();
  if (lower.includes("replace")) return <CircleXIcon className="size-3.5 text-red-500" />;
  if (lower.includes("repair") || lower.includes("service") || lower.includes("fix") || lower.includes("overhaul")) {
    return <CircleAlertIcon className="size-3.5 text-amber-500" />;
  }

  return <CircleCheckIcon className="size-3.5 text-green-500" />;
}

export const inspectionColumns: ColumnDef<InspectionRow>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all inspections on this page"
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label={`Select ${row.original.vehicles?.make ?? "inspection"}`}
        />
      </div>
    ),
    enableHiding: false,
  },
  {
    id: "vehicle",
    header: "Vehicle",
    cell: ({ row }) => {
      const vehicle = row.original.vehicles;

      return (
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-md border bg-muted">
            <Car className="size-4 text-muted-foreground" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="grid min-w-0 gap-0.5">
              <Link
                href={`/dashboard/inspections/${row.original.id}`}
                className="truncate font-medium text-sm leading-none hover:text-primary"
              >
                {vehicle ? `${vehicle.make} ${vehicle.model} (${vehicle.year})` : "—"}
              </Link>
              <span className="truncate text-muted-foreground text-xs leading-none">{vehicle?.stock_code ?? "—"}</span>
            </div>
          </div>
        </div>
      );
    },
    enableHiding: false,
  },
  {
    id: "search",
    accessorFn: (row) =>
      [row.id, row.mechanic_id, row.recommendation, row.vehicles?.make, row.vehicles?.model, row.vehicles?.stock_code]
        .filter(Boolean)
        .join(" "),
    filterFn: "includesString",
    enableHiding: true,
  },
  {
    accessorKey: "condition_score",
    header: "Score",
    cell: ({ row }) => {
      const score = row.original.condition_score;
      if (score === null) return <span className="text-muted-foreground">—</span>;
      return (
        <Badge variant="outline" className="px-1.5 text-muted-foreground">
          {score}/100
        </Badge>
      );
    },
  },
  {
    id: "scoreWindow",
    accessorFn: (row) => {
      const score = row.condition_score;

      if (score === null) return "none";
      if (score >= 90) return "90+";
      if (score >= 70) return "70-89";
      if (score >= 50) return "50-69";
      return "below-50";
    },
    filterFn: "equalsString",
    enableHiding: true,
  },
  {
    accessorKey: "recommendation",
    header: "Recommendation",
    filterFn: "equalsString",
    cell: ({ row }) => (
      <Badge variant="outline" className="px-1.5 text-muted-foreground">
        {recommendationIcon(row.original.recommendation)}
        <span className="max-w-44 truncate">{row.original.recommendation ?? "No recommendation"}</span>
      </Badge>
    ),
  },
  {
    accessorKey: "mechanic_id",
    header: "Mechanic",
    cell: ({ row }) => <span className="text-muted-foreground text-sm">{row.original.mechanic_id.slice(0, 8)}…</span>,
  },
  {
    accessorKey: "inspection_date",
    header: "Date",
    cell: ({ row }) => {
      const date = parseISO(row.original.inspection_date);

      return (
        <div className="grid gap-0.5">
          <span className="text-sm">{format(date, "do MMMM yyyy")}</span>
          <span className="text-muted-foreground text-xs">at {format(date, "h:mm a")}</span>
        </div>
      );
    },
  },
  {
    id: "dateWindow",
    accessorFn: (row) => {
      const daysSinceInspection = differenceInCalendarDays(endOfToday(), parseISO(row.inspection_date));

      if (daysSinceInspection <= 30) return ["30", "90"];
      if (daysSinceInspection <= 90) return ["90"];
      return [];
    },
    filterFn: "arrIncludes",
    enableHiding: true,
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
          <DropdownMenuItem asChild>
            <Link href={`/dashboard/vehicles/${row.original.vehicle_id}`}>
              <CarFront className="mr-2 size-4" />
              View Vehicle
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              const win = window.open(`/dashboard/inspections/${row.original.id}`, "_blank");
              win?.addEventListener("load", () => win.print());
            }}
          >
            <Printer className="mr-2 size-4" />
            Print Report
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
];
