import { redirect } from "next/navigation";

import { getCurrentRole } from "@/app/(auth)/actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createServerSupabase } from "@/lib/supabase/server";

export default async function PayrollPage() {
  const role = await getCurrentRole();
  if (!role || !["ceo", "account_manager", "head_accountant"].includes(role)) {
    redirect("/unauthorized");
  }

  const supabase = await createServerSupabase();
  const { data: runs } = await supabase.from("payroll_runs").select("*").order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-semibold text-3xl tracking-tight">Payroll</h1>
        <p className="text-muted-foreground text-sm">Manage payroll runs and view compensation records.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payroll Runs</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Gross</TableHead>
                <TableHead>Deductions</TableHead>
                <TableHead>Net</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(runs ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No payroll runs yet.
                  </TableCell>
                </TableRow>
              ) : (
                (runs ?? []).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      {new Date(r.period_start as string).toLocaleDateString()} —{" "}
                      {new Date(r.period_end as string).toLocaleDateString()}
                    </TableCell>
                    <TableCell>₱{((r.total_gross_cents as number) / 100).toLocaleString()}</TableCell>
                    <TableCell>₱{((r.total_deductions_cents as number) / 100).toLocaleString()}</TableCell>
                    <TableCell>₱{((r.total_net_cents as number) / 100).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant={r.status === "finalized" ? "default" : "secondary"}>{r.status as string}</Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
