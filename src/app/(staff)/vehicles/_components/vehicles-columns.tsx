"use client";

import Link from "next/link";

import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Pencil, Send } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const listingStateMeta: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  draft: { label: "Draft", variant: "secondary" },
  inspecting: { label: "Inspecting", variant: "outline" },
  repairing: { label: "Repairing", variant: "outline" },
  awaiting_price_approval: { label: "Awaiting Approval", variant: "secondary" },
  available: { label: "Available", variant: "default" },
  reserved: { label: "Reserved", variant: "secondary" },
  sold: { label: "Sold", variant: "outline" },
  archived: { label: "Archived", variant: "outline" },
};

export function createColumns(onPublish: (id: string) => void): ColumnDef<Record<string, unknown>>[] {
  return [
    {
      id: "search",
      accessorFn: (row) =>
        `${row.stock_code ?? ""} ${row.make ?? ""} ${row.model ?? ""} ${row.year ?? ""} ${row.vin ?? ""}`,
      filterFn: "includesString",
      enableHiding: true,
    },
    {
      accessorKey: "stock_code",
      header: "Stock Code",
      cell: ({ row }) => <span className="font-medium">{row.getValue("stock_code") as string}</span>,
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
            <span className="font-medium">
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
      cell: ({ row }) => <span className="capitalize">{row.getValue("condition") as string}</span>,
    },
    {
      accessorKey: "current_price",
      header: "Price",
      cell: ({ row }) => {
        const price = row.getValue("current_price") as number | null;
        if (!price) return <span className="text-muted-foreground">—</span>;
        return <span>₱{price.toLocaleString()}</span>;
      },
    },
    {
      accessorKey: "pricing_type",
      header: "Type",
      cell: ({ row }) => {
        const type = row.getValue("pricing_type") as string;
        return (
          <Badge variant="outline" className="capitalize">
            {type}
          </Badge>
        );
      },
    },
    {
      accessorKey: "listing_state",
      header: "Status",
      cell: ({ row }) => {
        const state = row.getValue("listing_state") as string;
        const meta = listingStateMeta[state] ?? { label: state, variant: "outline" as const };
        return (
          <Badge variant={meta.variant} className="capitalize">
            {meta.label}
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
        return <span>{miles.toLocaleString()} km</span>;
      },
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const vehicle = row.original;
        const id = vehicle.id as string;
        const state = vehicle.listing_state as string;

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/vehicles/${id}`}>
                  <Pencil className="mr-2 size-4" />
                  Edit
                </Link>
              </DropdownMenuItem>
              {state === "draft" && (
                <DropdownMenuItem onClick={() => onPublish(id)}>
                  <Send className="mr-2 size-4" />
                  Publish
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}
