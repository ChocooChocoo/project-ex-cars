import { redirect } from "next/navigation";

import { getCurrentRole } from "@/app/(auth)/actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createServerSupabase } from "@/lib/supabase/server";

export default async function EmployeeRequestsPage() {
  const role = await getCurrentRole();
  if (!role) redirect("/unauthorized");

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/v1/login");

  const isManager = ["ceo", "account_manager"].includes(role);
  const query = supabase.from("employee_requests").select("*").order("created_at", { ascending: false });
  if (!isManager) {
    query.eq("employee_id", user.id);
  }

  const { data: requests } = await query;

  const statusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "secondary",
      approved: "default",
      rejected: "destructive",
      cancelled: "outline",
    };
    return <Badge variant={variants[status] ?? "secondary"}>{status}</Badge>;
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-semibold text-3xl tracking-tight">Employee Requests</h1>
        <p className="text-muted-foreground text-sm">
          {isManager ? "Process leave, overtime, and schedule change requests." : "Your submitted requests."}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{isManager ? "All Requests" : "My Requests"}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kind</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(requests ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No requests submitted.
                  </TableCell>
                </TableRow>
              ) : (
                (requests ?? []).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium capitalize">{r.request_kind as string}</TableCell>
                    <TableCell className="text-sm">
                      {new Date(r.start_date as string).toLocaleDateString()}
                      {r.end_date ? ` — ${new Date(r.end_date as string).toLocaleDateString()}` : ""}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground text-sm">
                      {r.reason as string}
                    </TableCell>
                    <TableCell>{statusBadge(r.status as string)}</TableCell>
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
