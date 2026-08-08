import { redirect } from "next/navigation";

import { getCurrentRole } from "@/app/auth/actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createServerSupabase } from "@/lib/supabase/server";

import { AccountActionsCell } from "./_components/account-actions-cell";
import { type PerformanceReviewRow, PerformanceReviews } from "./_components/performance-reviews";
import { WalkInForm } from "./_components/walk-in-form";

export default async function StaffRecordsPage() {
  const role = await getCurrentRole();
  if (!role || !["ceo", "account_manager"].includes(role)) {
    redirect("/unauthorized");
  }

  const supabase = await createServerSupabase();
  const { data: profiles } = await supabase.from("profiles").select("*").order("full_name", { ascending: true });

  const { data: roles } = await supabase.rpc("get_all_user_roles");

  const roleMap = new Map<string, string>();
  for (const r of (roles as { account_id: string; role: string }[]) ?? []) {
    roleMap.set(r.account_id, r.role);
  }

  const staffRoleIds = (roles as { account_id: string; role: string }[] | null)
    ?.filter((r) => !["customer", "supplier"].includes(r.role))
    .map((r) => r.account_id);

  const staffProfiles = (profiles ?? []).filter((p) => staffRoleIds?.includes(p.id as string));
  const employeeOptions = staffProfiles.map((p) => ({ id: p.id as string, full_name: p.full_name as string | null }));

  const { data: reviews } = await supabase
    .from("performance_reviews")
    .select("*, profiles(full_name)")
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-3xl tracking-tight">Staff Records</h1>
          <p className="text-muted-foreground text-sm">Manage employee and customer accounts.</p>
        </div>
        <WalkInForm />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(profiles ?? []).map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.full_name as string}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{roleMap.get(p.id as string) ?? "none"}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.account_state === "active" ? "default" : "outline"}>
                      {p.account_state as string}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(p.created_at as string).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <AccountActionsCell
                      account={{
                        id: p.id as string,
                        full_name: (p.full_name as string | null) ?? null,
                        phone: (p.phone as string | null) ?? null,
                        address: (p.address as string | null) ?? null,
                        account_state: p.account_state as string,
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <PerformanceReviews
        reviews={(reviews as unknown as PerformanceReviewRow[]) ?? []}
        employees={employeeOptions}
        canManage={["ceo", "account_manager"].includes(role)}
      />
    </div>
  );
}
