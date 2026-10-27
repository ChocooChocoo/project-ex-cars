"use client";
"use no memo";

import * as React from "react";

import {
  type Column,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";

import { RejectReasonDialog } from "@/components/reject-reason-dialog";
import { TransactionImagePreview } from "@/components/transaction-image-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { paymentKindLabel, paymentMethodLabel } from "@/lib/transactions/labels";
import { formatCurrency } from "@/lib/utils";

type PaymentRow = Record<string, unknown>;

export function TransactionPaymentsTableV1({
  payments,
  canReview,
  onVerifyPayment,
  onRejectPayment,
}: {
  readonly payments: Record<string, unknown>[];
  /** CEO and Head Accountant: may verify or reject (same roles as the server actions). */
  readonly canReview: boolean;
  readonly onVerifyPayment: (paymentId: string) => Promise<void>;
  readonly onRejectPayment: (paymentId: string, reason: string) => Promise<void>;
}) {
  // T03 HA3: a rejected payment stays listed but never counts.
  const counted = payments.filter((p) => !p.rejected_at);
  const totalPaid = counted.reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
  const verified = counted.filter((p) => p.verified_by).length;
  const pending = counted.length - verified;
  const rejected = payments.length - counted.length;

  const [sorting, setSorting] = React.useState<SortingState>([{ id: "amount", desc: true }]);

  const columns = [
    {
      accessorKey: "amount",
      header: ({ column }: { column: Column<PaymentRow, unknown> }) => (
        <SortableHeader column={column} label="Amount" />
      ),
      cell: ({ row }: { row: { original: PaymentRow } }) => (
        <span className="font-medium text-xs tabular-nums">{formatCurrency(Number(row.original.amount))}</span>
      ),
    },
    {
      accessorKey: "payment_kind",
      header: () => <span className="text-xs">For</span>,
      enableSorting: false,
      cell: ({ row }: { row: { original: PaymentRow } }) => (
        <span className="text-xs">{paymentKindLabel(row.original.payment_kind as string | null)}</span>
      ),
    },
    {
      accessorKey: "method",
      header: () => <span className="text-xs">Method</span>,
      enableSorting: false,
      cell: ({ row }: { row: { original: PaymentRow } }) => (
        <span className="text-xs capitalize">{paymentMethodLabel(row.original.method as string)}</span>
      ),
    },
    {
      accessorKey: "settlement_date",
      header: ({ column }: { column: Column<PaymentRow, unknown> }) => <SortableHeader column={column} label="Date" />,
      cell: ({ row }: { row: { original: PaymentRow } }) => (
        <span className="text-xs tabular-nums">{row.original.settlement_date as string}</span>
      ),
    },
    {
      id: "proof",
      header: () => <span className="text-xs">Photo</span>,
      enableSorting: false,
      cell: ({ row }: { row: { original: PaymentRow } }) =>
        typeof row.original.proof_url === "string" ? (
          <TransactionImagePreview
            src={row.original.proof_url}
            alt="payment proof"
            className="object-cover"
            triggerClassName="h-10 w-14 border"
          />
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        ),
    },
    {
      accessorKey: "verified_by",
      header: () => <span className="text-xs">Verified</span>,
      enableSorting: false,
      cell: ({ row }: { row: { original: PaymentRow } }) => (
        <span className="text-xs">
          {row.original.rejected_at ? (
            <span className="flex flex-col items-start gap-1">
              <Badge variant="destructive" className="h-5 px-2 text-[11px]">
                Rejected
              </Badge>
              <span className="max-w-48 text-muted-foreground">{String(row.original.rejection_reason ?? "")}</span>
            </span>
          ) : row.original.paymongo_payment_id ? (
            <Badge
              className="h-5 border-green-600/35 bg-green-600/10 px-2 text-[11px] text-green-600"
              title={String(row.original.paymongo_payment_id)}
            >
              Paid on PayMongo
            </Badge>
          ) : row.original.verified_by ? (
            <Badge className="h-5 border-green-600/35 bg-green-600/10 px-2 text-[11px] text-green-600">Verified</Badge>
          ) : row.original.paymongo_checkout_id ? (
            <Badge variant="outline" className="h-5 px-2 text-[11px]">
              Waiting for PayMongo
            </Badge>
          ) : (
            <Badge variant="outline" className="h-5 px-2 text-[11px]">
              Pending
            </Badge>
          )}
        </span>
      ),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      enableSorting: false,
      cell: ({ row }: { row: { original: PaymentRow } }) =>
        // PayMongo confirms its own payments through the webhook; only payments recorded by staff are verified here.
        canReview && !row.original.verified_by && !row.original.rejected_at && !row.original.paymongo_checkout_id ? (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => onVerifyPayment(row.original.id as string)}
            >
              Verify
            </Button>
            <RejectReasonDialog
              trigger={
                <Button variant="ghost" size="sm" className="h-6 px-2 text-destructive text-xs">
                  Reject
                </Button>
              }
              title="Reject this payment?"
              description={`${formatCurrency(Number(row.original.amount))} stays on record as rejected and stops counting toward what was paid. The buyer sees your reason.`}
              placeholder="e.g. The amount on the cheque does not match"
              confirmLabel="Reject payment"
              onConfirm={(reason) => onRejectPayment(row.original.id as string, reason)}
            />
          </div>
        ) : null,
    },
  ];

  const table = useReactTable({
    data: payments,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <Card className="min-w-0 shadow-xs">
      <CardHeader>
        <CardTitle>Payment Records</CardTitle>
        <CardDescription>Recorded payments with verification status.</CardDescription>
        <CardAction>
          <Badge variant="outline" className="font-medium tabular-nums">
            {payments.length} Payments
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 rounded-lg border bg-muted/20 p-3 text-sm sm:grid-cols-4 sm:divide-x sm:divide-border/60">
          <LedgerStat label="Total paid" value={formatCurrency(totalPaid)} detail="verified and pending" />
          <LedgerStat label="Verified" value={String(verified)} detail="confirmed payments" />
          <LedgerStat label="Pending" value={String(pending)} detail="awaiting verification" />
          <LedgerStat label="Rejected" value={String(rejected)} detail="not counted" />
        </div>

        <div className="min-w-0 overflow-hidden rounded-lg border">
          <Table>
            <TableHeader className="bg-muted/30">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className="h-10 px-3 font-medium text-muted-foreground text-xs">
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="p-3 align-middle">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={table.getVisibleLeafColumns().length}
                    className="h-24 text-center text-muted-foreground text-sm"
                  >
                    No payments recorded.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function SortableHeader({ column, label }: { readonly column: Column<PaymentRow, unknown>; readonly label: string }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-mr-2 h-8 px-2 text-xs"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    >
      {label}
      <ArrowUpDown className="size-3" />
    </Button>
  );
}

function LedgerStat({
  label,
  value,
  detail,
}: {
  readonly label: string;
  readonly value: string;
  readonly detail: string;
}) {
  return (
    <div className="flex flex-col gap-1 px-0 sm:px-3 last:sm:pr-0 first:sm:pl-0">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="font-semibold text-base tabular-nums">{value}</div>
      <div className="text-muted-foreground text-xs">{detail}</div>
    </div>
  );
}
