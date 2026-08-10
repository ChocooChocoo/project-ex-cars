"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { differenceInCalendarDays, endOfToday, format, parseISO } from "date-fns";
import { Building2, Check, Eye, MoreHorizontal, UserRound, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type { SupplierRow } from "./schema";

function kindIcon(kind: string) {
  return kind === "company" ? (
    <Building2 className="size-3.5 text-muted-foreground" />
  ) : (
    <UserRound className="size-3.5 text-muted-foreground" />
  );
}

export function createSupplierColumns({
  onViewDetails,
  onApprove,
  onReject,
  verifiedPrimaryCount,
}: {
  readonly onViewDetails: (supplier: SupplierRow) => void;
  readonly onApprove: (supplier: SupplierRow) => void;
  readonly onReject: (supplier: SupplierRow) => void;
  readonly verifiedPrimaryCount: (supplierId: string) => number;
}): ColumnDef<SupplierRow>[] {
  return [
    {
      id: "select",
      header: ({ table }) => (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all suppliers on this page"
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label={`Select ${row.original.business_name}`}
          />
        </div>
      ),
      enableHiding: false,
    },
    {
      accessorKey: "business_name",
      header: "Supplier",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-md border bg-muted">
            <Building2 className="size-4 text-muted-foreground" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="grid min-w-0 gap-0.5">
              <span className="truncate font-medium text-sm leading-none">{row.original.business_name}</span>
              <span className="truncate text-muted-foreground text-xs leading-none">{row.original.contact_email}</span>
            </div>
          </div>
        </div>
      ),
      enableHiding: false,
    },
    {
      id: "search",
      accessorFn: (row) =>
        `${row.id} ${row.business_name} ${row.supplier_kind} ${row.state} ${row.contact_name} ${row.contact_email} ${row.contact_phone}`,
      filterFn: "includesString",
      enableHiding: true,
    },
    {
      accessorKey: "state",
      header: "State",
      filterFn: "equalsString",
      cell: ({ row }) => (
        <Badge variant="outline" className="px-1.5 text-muted-foreground capitalize">
          {row.original.state.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      accessorKey: "supplier_kind",
      header: "Kind",
      filterFn: "equalsString",
      cell: ({ row }) => (
        <Badge variant="outline" className="px-1.5 text-muted-foreground capitalize">
          {kindIcon(row.original.supplier_kind)}
          {row.original.supplier_kind}
        </Badge>
      ),
    },
    {
      accessorKey: "contact_name",
      header: "Contact",
      cell: ({ row }) => <span className="text-sm">{row.original.contact_name}</span>,
    },
    {
      id: "createdWindow",
      accessorFn: (row) => {
        const daysSinceCreated = differenceInCalendarDays(endOfToday(), parseISO(row.created_at));

        if (daysSinceCreated <= 30) return ["30", "90"];
        if (daysSinceCreated <= 90) return ["90"];
        return [];
      },
      filterFn: "arrIncludes",
      enableHiding: true,
    },
    {
      accessorKey: "created_at",
      header: "Created",
      cell: ({ row }) => {
        const created = parseISO(row.original.created_at);

        return (
          <div className="grid gap-0.5">
            <span className="text-sm">{format(created, "do MMMM yyyy")}</span>
            <span className="text-muted-foreground text-xs">at {format(created, "h:mm a")}</span>
          </div>
        );
      },
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const supplier = row.original;
        const verifiedCount = verifiedPrimaryCount(supplier.id);

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label={`Open actions for ${supplier.business_name}`}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onViewDetails(supplier)}>
                <Eye className="mr-2 size-4" />
                View Documents
              </DropdownMenuItem>
              {supplier.state === "pending_approval" ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    disabled={verifiedCount < 2}
                    title={verifiedCount < 2 ? "Two primary valid IDs must be verified before approval." : undefined}
                    onClick={() => onApprove(supplier)}
                  >
                    <Check className="mr-2 size-4" />
                    Approve
                  </DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" onClick={() => onReject(supplier)}>
                    <X className="mr-2 size-4" />
                    Reject
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      enableHiding: false,
    },
  ];
}
