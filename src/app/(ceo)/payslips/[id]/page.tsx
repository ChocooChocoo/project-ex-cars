import { redirect } from "next/navigation";

import { getCurrentRole } from "@/app/(auth)/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createServerSupabase } from "@/lib/supabase/server";

export default async function PayslipDetailPage({ params }: { readonly params: Promise<{ id: string }> }) {
  const { id } = await params;
  const role = await getCurrentRole();
  if (!role) redirect("/unauthorized");

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/v1/login");

  const { data: payslip } = await supabase.from("payslips").select("*, payroll_runs(*)").eq("id", id).single();

  if (!payslip) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="font-semibold text-3xl tracking-tight">Payslip Not Found</h1>
      </div>
    );
  }

  const isEmployee = payslip.employee_id === user.id;
  const isAuthorized = ["ceo", "account_manager", "head_accountant"].includes(role);
  if (!isEmployee && !isAuthorized) redirect("/unauthorized");

  const { data: items } = await supabase.from("payslip_items").select("*").eq("payslip_id", id);

  const earnings = (items ?? []).filter((i) => i.item_kind === "earning");
  const deductions = (items ?? []).filter((i) => i.item_kind === "deduction");

  const payrollRun = payslip.payroll_runs as Record<string, unknown> | null;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="font-semibold text-3xl tracking-tight">Payslip</h1>
        <p className="text-muted-foreground text-sm">
          {payrollRun
            ? `${new Date(payrollRun.period_start as string).toLocaleDateString()} — ${new Date(payrollRun.period_end as string).toLocaleDateString()}`
            : "No period"}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Gross Pay</span>
            <span>₱{((payslip.gross_cents as number) / 100).toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Deductions</span>
            <span>₱{((payslip.deductions_cents as number) / 100).toLocaleString()}</span>
          </div>
          <Separator />
          <div className="flex justify-between font-semibold">
            <span>Net Pay</span>
            <span>₱{((payslip.net_cents as number) / 100).toLocaleString()}</span>
          </div>
        </CardContent>
      </Card>

      {earnings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Earnings</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {earnings.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{e.label as string}</TableCell>
                    <TableCell className="text-right">₱{((e.amount_cents as number) / 100).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {deductions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Deductions</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deductions.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>{d.label as string}</TableCell>
                    <TableCell className="text-right">₱{((d.amount_cents as number) / 100).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
