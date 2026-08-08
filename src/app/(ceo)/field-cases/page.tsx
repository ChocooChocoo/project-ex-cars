import { redirect } from "next/navigation";

import { getCurrentRole } from "@/app/(auth)/actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createServerSupabase } from "@/lib/supabase/server";

export default async function FieldCasesPage() {
  const role = await getCurrentRole();
  if (
    !role ||
    !["ceo", "confidential_informant", "sales_manager", "mechanic", "head_security", "account_manager"].includes(role)
  ) {
    redirect("/unauthorized");
  }

  const supabase = await createServerSupabase();
  const { data: cases } = await supabase.from("field_cases").select("*").order("created_at", { ascending: false });

  const stateBadge = (state: string) => {
    const variants: Record<string, "default" | "secondary" | "outline"> = {
      assigned: "secondary",
      accepted: "default",
      in_progress: "default",
      completed: "default",
      cancelled: "outline",
    };
    return <Badge variant={variants[state] ?? "secondary"}>{state}</Badge>;
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-semibold text-3xl tracking-tight">Field Cases</h1>
        <p className="text-muted-foreground text-sm">Acquisition, delivery, sourcing, and recovery assignments.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Cases</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kind</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Expenses</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(cases ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No field cases assigned.
                  </TableCell>
                </TableRow>
              ) : (
                (cases ?? []).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium capitalize">{c.case_kind as string}</TableCell>
                    <TableCell>{stateBadge(c.state as string)}</TableCell>
                    <TableCell>{c.vehicle_id ? (c.vehicle_id as string).slice(0, 8) : "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{(c.location as string) ?? "—"}</TableCell>
                    <TableCell>
                      {c.expenses_cents ? `₱${((c.expenses_cents as number) / 100).toLocaleString()}` : "₱0"}
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
