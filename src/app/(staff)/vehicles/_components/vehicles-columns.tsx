"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Pencil, Send } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { listingStateLabel, listingStateVariant } from "@/lib/vehicles/labels";

export function createColumns(
  onPublish: (id: string) => void,
  onEdit: (vehicle: Record<string, unknown>) => void,
): ColumnDef<Record<string, unknown>>[] {
  return [
    {
      id: "select",
      header: ({ table }) => (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all vehicles on this page"
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label={`Select vehicle ${(row.original.stock_code as string) ?? ""}`}
          />
        </div>
      ),
      enableHiding: false,
      enableSorting: false,
    },
    {
      id: "search",
      accessorFn: (row) =>
        `${row.stock_code ?? ""} ${row.make ?? ""} ${row.model ?? ""} ${row.year ?? ""} ${row.vin ?? ""}`,
      filterFn: "includesString",
      enableHiding: true,
    },
    {
      id: "created_at",
      accessorFn: (row) => row.created_at,
      enableHiding: true,
    },
    {
      accessorKey: "stock_code",
      header: "Stock Code",
      cell: ({ row }) => <span className="font-medium text-sm">{row.getValue("stock_code") as string}</span>,
    },
    {
      id: "vehicle",
      header: "Vehicle",
      cell: ({ row }) => {
        const make = row.getValue("make") as string;
        const model = row.getValue("model") as string;
        const year = row.getValue("year") as number;
        return (
          <div className="grid gap-0.5">
            <span className="font-medium text-sm">
              {make} {model}
            </span>
            <span className="text-muted-foreground text-xs">{year}</span>
          </div>
        );
      },
    },
    {
      accessorKey: "condition",
      header: "Condition",
      filterFn: "equalsString",
      cell: ({ row }) => <span className="text-sm capitalize">{row.getValue("condition") as string}</span>,
    },
    {
      accessorKey: "current_price",
      header: "Price",
      cell: ({ row }) => {
        const price = row.getValue("current_price") as number | null;
        if (!price) return <span className="text-muted-foreground">—</span>;
        return <span className="text-sm">₱{price.toLocaleString()}</span>;
      },
    },
    {
      accessorKey: "pricing_type",
      header: "Type",
      filterFn: "equalsString",
      cell: ({ row }) => {
        const type = row.getValue("pricing_type") as string;
        return (
          <Badge variant="outline" className="px-1.5 text-muted-foreground capitalize">
            {type}
          </Badge>
        );
      },
    },
    {
      accessorKey: "listing_state",
      header: "Status",
      filterFn: "equalsString",
      cell: ({ row }) => {
        const state = row.getValue("listing_state") as string;
        return (
          <Badge variant={listingStateVariant(state)} className="capitalize">
            {listingStateLabel(state)}
          </Badge>
        );
      },
    },
    {
      accessorKey: "mileage",
      header: "Mileage",
      cell: ({ row }) => {
        const miles = row.getValue("mileage") as number | null;
        if (!miles) return <span className="text-muted-foreground">—</span>;
        return <span className="text-sm">{miles.toLocaleString()} km</span>;
      },
    },
    {
      id: "actions",
      header: () => <div className="text-right">Actions</div>,
      cell: ({ row }) => {
        const vehicle = row.original;
        const id = vehicle.id as string;
        const state = vehicle.listing_state as string;

        return (
          <div className="text-right">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  aria-label={`Open actions for ${(vehicle.stock_code as string) ?? ""}`}
                  className="size-8 rounded-md text-muted-foreground hover:bg-muted/50"
                  size="icon-sm"
                  variant="ghost"
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(vehicle)}>
                  <Pencil className="mr-2 size-4" />
                  Edit
                </DropdownMenuItem>
                {state === "draft" && (
                  <DropdownMenuItem onClick={() => onPublish(id)}>
                    <Send className="mr-2 size-4" />
                    Publish
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
      enableHiding: false,
      enableSorting: false,
    },
  ];
}
