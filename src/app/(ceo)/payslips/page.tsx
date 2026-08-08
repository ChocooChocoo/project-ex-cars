import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentRole } from "@/app/auth/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createServerSupabase } from "@/lib/supabase/server";

export default async function PayslipsListPage() {
  const role = await getCurrentRole();
  if (!role) redirect("/unauthorized");

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/v1/login");

  const isAuthorized = ["ceo", "account_manager", "head_accountant"].includes(role);
  const query = supabase.from("payslips").select("*, payroll_runs(*)").order("created_at", { ascending: false });
  if (!isAuthorized) {
    query.eq("employee_id", user.id);
  }

  const { data: payslips } = await query;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-semibold text-3xl tracking-tight">Payslips</h1>
        <p className="text-muted-foreground text-sm">
          {isAuthorized ? "All employee payslips." : "Your payslip history."}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{isAuthorized ? "All Payslips" : "My Payslips"}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Gross</TableHead>
                <TableHead>Net</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(payslips ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No payslips available.
                  </TableCell>
                </TableRow>
              ) : (
                (payslips ?? []).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      {new Date(
                        (p.payroll_runs as Record<string, unknown>).period_start as string,
                      ).toLocaleDateString()}{" "}
                      —{" "}
                      {new Date((p.payroll_runs as Record<string, unknown>).period_end as string).toLocaleDateString()}
                    </TableCell>
                    <TableCell>₱{((p.gross_cents as number) / 100).toLocaleString()}</TableCell>
                    <TableCell>₱{((p.net_cents as number) / 100).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant={p.status === "finalized" ? "default" : "secondary"}>{p.status as string}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/dashboard/payslips/${p.id}`}>View</Link>
                      </Button>
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
