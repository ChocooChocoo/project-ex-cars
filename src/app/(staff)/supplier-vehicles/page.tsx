"use client";

import { useState } from "react";

import { toast } from "sonner";

import { useRequireRole } from "@/components/auth/session-provider";
import { PageSkeleton } from "@/components/page-skeleton";
import { SupplierPostChat } from "@/components/suppliers/supplier-post-chat";
import { SupplierPostDetails } from "@/components/suppliers/supplier-post-details";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiAction } from "@/lib/api/action";
import { browserApi } from "@/lib/api/client";
import { usePageData } from "@/lib/api/use-page-data";
import type { GceRole } from "@/lib/auth/roles";
import { SUPPLIER_POST_STATE_LABELS, type SupplierPost, supplierPostTitle } from "@/lib/suppliers/supplier-posts";
import { cn, formatCurrency } from "@/lib/utils";

const VIEWER_ROLES: GceRole[] = ["marketing_specialist", "confidential_informant", "ceo"];

// Notes lines 56-72: supplier posts for the Marketing Specialist (review, chat, propose, assign), the CEO
// (approve or reject) and the Confidential Informant (read).
export default function SupplierVehiclesPage() {
  const allowed = useRequireRole(VIEWER_ROLES);
  const list = usePageData(allowed ? "supplier-posts" : "supplier-posts:denied", () =>
    allowed
      ? browserApi<{ role: GceRole; posts: SupplierPost[] }>("GET", "/api/v1/staff/supplier-posts")
      : Promise.resolve(null),
  );
  const [picked, setPicked] = useState<string | null>(() =>
    typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("post"),
  );
  if (list.error) throw list.error;
  if (!allowed || !list.data) return <PageSkeleton />;
  const { role, posts } = list.data;
  const selectedId = picked ?? posts[0]?.id ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-semibold text-3xl tracking-tight">Supplier Vehicles</h1>
        <p className="text-muted-foreground text-sm">Vehicles suppliers offer to GCE. Not shown in the showroom.</p>
      </div>
      {posts.length === 0 ? (
        <p className="text-muted-foreground text-sm">No supplier vehicles yet.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
          <ul className="flex flex-col gap-2" aria-label="Supplier vehicles">
            {posts.map((post) => (
              <li key={post.id}>
                <button
                  type="button"
                  onClick={() => setPicked(post.id)}
                  aria-current={post.id === selectedId ? "true" : undefined}
                  className={cn(
                    "flex w-full flex-col gap-1 rounded-md border p-3 text-left text-sm hover:bg-muted/50",
                    post.id === selectedId && "border-primary bg-muted/40",
                  )}
                >
                  <span className="font-medium">{supplierPostTitle(post)}</span>
                  <span className="text-muted-foreground text-xs">{post.company_name ?? "Supplier"}</span>
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="tabular-nums">{formatCurrency(post.asking_price)}</span>
                    <Badge variant="outline">{SUPPLIER_POST_STATE_LABELS[post.state] ?? post.state}</Badge>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {selectedId ? <SupplierPostPanel key={selectedId} id={selectedId} role={role} /> : null}
        </div>
      )}
    </div>
  );
}

function SupplierPostPanel({ id, role }: { readonly id: string; readonly role: GceRole }) {
  const page = usePageData(`supplier-post:${id}`, () =>
    browserApi<{ post: SupplierPost }>("GET", `/api/v1/staff/supplier-posts/${id}`),
  );
  const [busy, setBusy] = useState(false);
  if (page.error) throw page.error;
  if (!page.data) return <PageSkeleton />;
  const { post } = page.data;

  async function run(path: string, body: Record<string, string>, message: string) {
    setBusy(true);
    const result = await apiAction(path, body);
    setBusy(false);
    if (result.error) toast.error(result.error);
    else toast.success(message);
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="pt-4">
          <SupplierPostDetails post={post} />
        </CardContent>
      </Card>

      {post.market_value != null ? (
        <Card>
          <CardHeader>
            <CardTitle>Purchase proposal</CardTitle>
            <CardDescription>The Marketing Specialist&apos;s proposal to the CEO.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <p>
              Market value: <span className="font-medium tabular-nums">{formatCurrency(post.market_value)}</span>
            </p>
            {post.proposal_reason ? <p className="whitespace-pre-line">{post.proposal_reason}</p> : null}
            {post.decision_reason ? (
              <p className="text-muted-foreground">CEO&apos;s reason: {post.decision_reason}</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {role === "marketing_specialist" && post.state === "posted" ? (
        <Card>
          <CardHeader>
            <CardTitle>Propose to the CEO</CardTitle>
            <CardDescription>Give the market value and why GCE should buy this vehicle.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="flex flex-col gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                const data = Object.fromEntries(new FormData(event.currentTarget).entries()) as Record<string, string>;
                void run(`/staff/supplier-posts/${id}/propose`, data, "Proposal sent to the CEO.");
              }}
            >
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="proposal-market-value">Market value (₱) *</Label>
                <Input
                  id="proposal-market-value"
                  name="market_value"
                  type="number"
                  min={1}
                  required
                  className="max-w-48"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="proposal-reason">Reason *</Label>
                <Textarea id="proposal-reason" name="reason" required maxLength={1000} rows={3} />
              </div>
              <Button type="submit" size="sm" className="self-start" disabled={busy}>
                Propose to CEO
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {role === "ceo" && post.state === "proposed" ? (
        <Card>
          <CardHeader>
            <CardTitle>CEO decision</CardTitle>
            <CardDescription>Approving sends it back to the Marketing Specialist. Rejecting ends it.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="flex flex-col gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                const decision = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") ?? "approved";
                void run(
                  `/staff/supplier-posts/${id}/decide`,
                  { decision, reason: String(form.get("reason") ?? "") },
                  decision === "approved" ? "Purchase approved." : "Purchase rejected.",
                );
              }}
            >
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="decision-reason">Reason (optional)</Label>
                <Textarea id="decision-reason" name="reason" maxLength={1000} rows={2} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" size="sm" value="approved" disabled={busy}>
                  Approve
                </Button>
                <Button type="submit" size="sm" variant="outline" value="rejected" disabled={busy}>
                  Reject
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {post.thread_id ? (
        <Card>
          <CardHeader>
            <CardTitle>Chat with the supplier</CardTitle>
          </CardHeader>
          <CardContent>
            <SupplierPostChat
              threadId={post.thread_id}
              perspective="staff"
              readOnly={role !== "marketing_specialist"}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
