"use client";

import { useState } from "react";

import { format } from "date-fns";
import { toast } from "sonner";

import { useRequireRole } from "@/components/auth/session-provider";
import { PageSkeleton } from "@/components/page-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiAction } from "@/lib/api/action";
import { browserApi } from "@/lib/api/client";
import { usePageData } from "@/lib/api/use-page-data";
import type { GceRole } from "@/lib/auth/roles";

const SUPPLIER_ADMIN_ROLES: GceRole[] = ["account_manager", "ceo"];

interface SupplierRow {
  user_id: string;
  company_name: string;
  approval_state: "pending" | "approved" | "rejected";
  email: string;
  email_verified: boolean;
  full_name: string | null;
  created_at: string | null;
}

const STATE_LABELS: Record<SupplierRow["approval_state"], string> = {
  pending: "Waiting for approval",
  approved: "Approved",
  rejected: "Rejected",
};

// Notes lines 36-40: the Account Manager creates supplier accounts and approves self-registered ones.
export default function SuppliersPage() {
  const allowed = useRequireRole(SUPPLIER_ADMIN_ROLES);
  const page = usePageData(allowed ? "suppliers" : "suppliers:denied", () =>
    allowed ? browserApi<{ suppliers: SupplierRow[] }>("GET", "/api/v1/admin/suppliers") : Promise.resolve(null),
  );
  const [busy, setBusy] = useState(false);
  if (page.error) throw page.error;
  if (!allowed || !page.data) return <PageSkeleton />;

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    setBusy(true);
    const result = await apiAction("/admin/accounts/supplier", data);
    setBusy(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Supplier account created. The supplier gets an email to set a password.");
    form.reset();
  }

  async function decide(userId: string, decision: "approved" | "rejected") {
    setBusy(true);
    const result = await apiAction("/admin/suppliers/decide", { user_id: userId, decision });
    setBusy(false);
    if (result.error) toast.error(result.error);
    else toast.success(decision === "approved" ? "Supplier approved." : "Supplier rejected.");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-semibold text-3xl tracking-tight">Suppliers</h1>
        <p className="text-muted-foreground text-sm">Supplier accounts and their approval.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create Supplier Account</CardTitle>
          <CardDescription>
            Use the email the CEO gave you. The supplier gets an email saying they now have an account on the GCE
            website, with a link to set their own password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={create} className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="supplier-company">Supplier Company Name *</Label>
              <Input id="supplier-company" name="company_name" required maxLength={200} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="supplier-name">Full Name *</Label>
              <Input id="supplier-name" name="full_name" required placeholder="Juan Dela Cruz" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="supplier-email">Email *</Label>
              <Input id="supplier-email" name="email" type="email" required placeholder="supplier@gmail.com" />
            </div>
            <Button type="submit" size="sm" className="self-start" disabled={busy}>
              Create Account
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Supplier approvals</CardTitle>
          <CardDescription>Suppliers who signed up themselves wait here until you approve them.</CardDescription>
        </CardHeader>
        <CardContent>
          {page.data.suppliers.length === 0 ? (
            <p className="text-muted-foreground text-sm">No suppliers yet.</p>
          ) : (
            <ul className="flex flex-col divide-y text-sm">
              {page.data.suppliers.map((row) => (
                <li key={row.user_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="flex flex-col">
                    <span className="font-medium">{row.company_name}</span>
                    <span className="text-muted-foreground text-xs">
                      {row.full_name ?? "—"} · {row.email}
                      {row.email_verified ? "" : " (email not verified)"}
                      {row.created_at ? ` · ${format(new Date(row.created_at), "MMM d, yyyy")}` : ""}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={row.approval_state === "pending" ? "outline" : "secondary"}>
                      {STATE_LABELS[row.approval_state]}
                    </Badge>
                    {row.approval_state === "pending" ? (
                      <>
                        <Button size="sm" disabled={busy} onClick={() => decide(row.user_id, "approved")}>
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => decide(row.user_id, "rejected")}
                        >
                          Reject
                        </Button>
                      </>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
