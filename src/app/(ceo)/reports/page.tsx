import { redirect } from "next/navigation";

import { getCurrentRole } from "@/app/auth/actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createServerSupabase } from "@/lib/supabase/server";

export default async function ReportsPage() {
  const role = await getCurrentRole();
  if (!role || !["ceo", "head_accountant", "account_manager"].includes(role)) {
    redirect("/unauthorized");
  }

  const supabase = await createServerSupabase();
  const { data: reports } = await supabase.from("reports").select("*").order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-semibold text-3xl tracking-tight">Reports</h1>
        <p className="text-muted-foreground text-sm">Financial and operational report submissions.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Submitted Reports</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(reports ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No reports submitted.
                  </TableCell>
                </TableRow>
              ) : (
                (reports ?? []).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.title as string}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">
                        {(r.report_kind as string).replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {r.period_start ? `${new Date(r.period_start as string).toLocaleDateString()} — ` : ""}
                      {r.period_end ? new Date(r.period_end as string).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.status === "submitted" ? "default" : "secondary"}>{r.status as string}</Badge>
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
