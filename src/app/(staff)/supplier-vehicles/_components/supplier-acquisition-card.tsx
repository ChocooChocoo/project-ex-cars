"use client";

import { useState } from "react";

import Link from "next/link";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiAction } from "@/lib/api/action";
import { browserApi } from "@/lib/api/client";
import { usePageData } from "@/lib/api/use-page-data";
import type { GceRole } from "@/lib/auth/roles";
import type { SupplierPost } from "@/lib/suppliers/supplier-posts";

type Worker = { account_id: string; role: string; full_name: string | null };

const SELECT_CLASS =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Notes lines 70-93: after the CEO's approval the Marketing Specialist assigns a Mechanic and a Confidential
 * Informant. That opens the sell transaction, so the field case, purchase fund, inspection, reconditioning and
 * posting run on the same screens as a customer's car.
 */
export function SupplierAcquisitionCard({ post, role }: { readonly post: SupplierPost; readonly role: GceRole }) {
  const canAssign = role === "marketing_specialist" && post.state === "approved" && !post.transaction_id;
  const workers = usePageData(canAssign ? "field-workers" : "field-workers:off", () =>
    canAssign ? browserApi<{ workers: Worker[] }>("GET", "/api/v1/staff/field-workers") : Promise.resolve(null),
  );
  const [busy, setBusy] = useState(false);

  if (post.transaction_id) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Purchase</CardTitle>
          <CardDescription>
            The field case, purchase fund, inspection and posting continue on the sell transaction.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild size="sm" variant="outline">
            <Link href={`/dashboard/transactions/${post.transaction_id}`}>Open the purchase</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }
  if (!canAssign) return null;

  const list = workers.data?.workers ?? [];
  const informants = list.filter((worker) => worker.role === "confidential_informant");
  const mechanics = list.filter((worker) => worker.role === "mechanic");

  async function assign(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries()) as Record<string, string>;
    if (data.schedule) data.schedule = new Date(data.schedule).toISOString();
    setBusy(true);
    const result = await apiAction(`/staff/supplier-posts/${post.id}/assign`, data);
    setBusy(false);
    if (result.error) toast.error(result.error);
    else toast.success("Mechanic and Confidential Informant assigned.");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Assign the field team</CardTitle>
        <CardDescription>The CEO approved this purchase. Choose who inspects and pays for the car.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={assign} className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="assign-ci">Confidential Informant *</Label>
            <select id="assign-ci" name="informant_id" required className={SELECT_CLASS} defaultValue="">
              <option value="" disabled>
                Choose
              </option>
              {informants.map((worker) => (
                <option key={worker.account_id} value={worker.account_id}>
                  {worker.full_name ?? "Confidential Informant"}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="assign-mechanic">Mechanic *</Label>
            <select id="assign-mechanic" name="mechanic_id" required className={SELECT_CLASS} defaultValue="">
              <option value="" disabled>
                Choose
              </option>
              {mechanics.map((worker) => (
                <option key={worker.account_id} value={worker.account_id}>
                  {worker.full_name ?? "Mechanic"}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="assign-schedule">Inspection date and time *</Label>
            <Input id="assign-schedule" name="schedule" type="datetime-local" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="assign-price">Agreed price (₱, max the market value) *</Label>
            <Input
              id="assign-price"
              name="agreed_price"
              type="number"
              min={1}
              max={post.market_value ?? undefined}
              required
              defaultValue={post.market_value ?? undefined}
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="assign-location">Supplier address *</Label>
            <Input id="assign-location" name="location" required maxLength={500} />
          </div>
          <Button type="submit" size="sm" className="self-start" disabled={busy}>
            Assign
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
