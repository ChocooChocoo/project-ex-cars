import Link from "next/link";

import { format } from "date-fns";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { paymentMethodLabel } from "@/lib/transactions/labels";
import { formatCurrency } from "@/lib/utils";

export interface SaleRecordRow {
  id: string;
  completed_at: string | null;
  vehicles: { make: string; model: string; year: number; stock_code: string } | null;
  profiles: { full_name: string | null } | null;
  purchase_details:
    | { final_price: number | null; payment_method: string }
    | { final_price: number | null; payment_method: string }[]
    | null;
  payment_records: { amount: number; payment_kind: string | null }[] | null;
}

const KIND_LABELS: Record<string, string> = {
  delivery_fee: "delivery fee",
  downpayment: "downpayment",
  balance: "balance",
  reschedule_fee: "reschedule fee",
};

function breakdown(payments: { amount: number; payment_kind: string | null }[]) {
  const parts = Object.entries(KIND_LABELS)
    .map(([kind, label]) => {
      const total = payments.filter((p) => p.payment_kind === kind).reduce((sum, p) => sum + Number(p.amount), 0);
      return total > 0 ? `${label} ${formatCurrency(total)}` : null;
    })
    .filter(Boolean);
  return parts.length > 0 ? <div className="text-muted-foreground text-xs">{parts.join(" · ")}</div> : null;
}

// §2 step 7: once a car is marked sold, its sale figures are listed for the Head Accountant's records.
export function SaleRecordsCard({ sales }: { readonly sales: SaleRecordRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sale records</CardTitle>
        <CardDescription>Cars marked sold to a buyer, with their sale figures.</CardDescription>
      </CardHeader>
      <CardContent>
        {sales.length === 0 ? (
          <p className="text-muted-foreground text-sm">No completed sales yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sold</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Buyer</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Sale price</TableHead>
                  <TableHead className="text-right">Payments received</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.map((sale) => {
                  const details = Array.isArray(sale.purchase_details)
                    ? sale.purchase_details[0]
                    : sale.purchase_details;
                  const received = (sale.payment_records ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
                  return (
                    <TableRow key={sale.id}>
                      <TableCell className="tabular-nums">
                        {sale.completed_at ? format(new Date(sale.completed_at), "MMM d, yyyy") : "—"}
                      </TableCell>
                      <TableCell>
                        <Link href={`/dashboard/transactions/${sale.id}`} className="underline">
                          {sale.vehicles
                            ? `${sale.vehicles.year} ${sale.vehicles.make} ${sale.vehicles.model}`
                            : sale.id.slice(0, 8)}
                        </Link>
                      </TableCell>
                      <TableCell>{sale.profiles?.full_name ?? "—"}</TableCell>
                      <TableCell>{details ? paymentMethodLabel(details.payment_method) : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {details?.final_price ? formatCurrency(Number(details.final_price)) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(received)}
                        {/* §4 step 10: a delivery sale shows its fee and downpayment separately. */}
                        {breakdown(sale.payment_records ?? [])}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
