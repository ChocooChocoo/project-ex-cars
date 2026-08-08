"use client";
"use no memo";

import Link from "next/link";

import { ClipboardList, ReceiptText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { transactionKindLabel, transactionStatusBadgeVariant } from "@/lib/transactions/labels";
import { TRANSACTION_STATE_LABELS, type TransactionState } from "@/lib/transactions/state-machine";

export function TransactionsList({
  transactions,
  baseUrl,
}: {
  readonly transactions: Record<string, unknown>[];
  readonly baseUrl: string;
}) {
  if (transactions.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-12">
          <ReceiptText className="size-12 text-muted-foreground/50" />
          <p className="text-muted-foreground text-sm">No transactions yet.</p>
          <p className="text-muted-foreground text-xs">
            Buy a vehicle from the showroom, request a car, or sell your vehicle to get started.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {transactions.map((tx) => {
        const id = tx.id as string;
        const kind = tx.transaction_kind as string;
        const state = (tx.current_state ?? "pending") as TransactionState;
        const vehicles = tx.vehicles as Record<string, unknown> | undefined;
        const openedAt = tx.opened_at as string;

        return (
          <Link key={id} href={`${baseUrl}/${id}`}>
            <Card className="transition-shadow hover:shadow-sm">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                  <ClipboardList className="size-5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">
                      {vehicles
                        ? `${vehicles.make} ${vehicles.model} (${vehicles.year})`
                        : transactionKindLabel(kind as never)}
                    </span>
                    <Badge variant={transactionStatusBadgeVariant(state)} className="text-xs">
                      {TRANSACTION_STATE_LABELS[state]}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground text-xs">
                    <span>{transactionKindLabel(kind as never)}</span>
                    <span>{new Date(openedAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
