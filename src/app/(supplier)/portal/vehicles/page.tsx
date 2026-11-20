"use client";

import { useState } from "react";

import { toast } from "sonner";

import { PageSkeleton } from "@/components/page-skeleton";
import { SupplierPostDetails } from "@/components/suppliers/supplier-post-details";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePageData } from "@/lib/api/use-page-data";
import { isActiveSupplierPost, type SupplierPost } from "@/lib/suppliers/supplier-posts";

import { SupplierAccessNotice } from "../_components/supplier-access-notice";
import { SupplierPostForm } from "../_components/supplier-post-form";
import { createSupplierPost, getSupplierDashboard, updateSupplierPost, withdrawSupplierPost } from "../actions";

// Notes lines 52-55: the supplier posts photos and details. Purchased posts leave the active list.
export default function SupplierVehiclesPage() {
  const page = usePageData("supplier-dashboard", getSupplierDashboard);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (page.error) return <SupplierAccessNotice error={page.error} />;
  if (!page.data) return <PageSkeleton />;
  const selected = new URLSearchParams(window.location.search).get("post");
  const active = page.data.posts.filter(isActiveSupplierPost);
  const history = page.data.posts.filter((post) => !isActiveSupplierPost(post));

  async function withdraw(post: SupplierPost) {
    setBusy(true);
    const result = await withdrawSupplierPost(post.id);
    setBusy(false);
    if (result.error) toast.error(result.error);
    else toast.success("Vehicle withdrawn.");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-semibold text-3xl tracking-tight">Vehicle Posting</h1>
        <p className="text-muted-foreground text-sm">
          Post vehicles you want GCE to buy. Only GCE&apos;s buying team sees them; they never appear in the showroom.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Post a vehicle</CardTitle>
          <CardDescription>Add clear photos of the outside, the inside and the odometer.</CardDescription>
        </CardHeader>
        <CardContent>
          <SupplierPostForm
            withPhotos
            submitLabel="Post vehicle"
            onSubmit={async (formData) => {
              const result = await createSupplierPost(formData);
              if (result.error) {
                toast.error(result.error);
                return false;
              }
              toast.success("Vehicle posted. GCE will review it.");
              return true;
            }}
          />
        </CardContent>
      </Card>

      <section className="flex flex-col gap-3" aria-label="Active posts">
        <h2 className="font-medium tracking-tight">Active posts</h2>
        {active.length === 0 ? <p className="text-muted-foreground text-sm">No active posts.</p> : null}
        {active.map((post) => (
          <Card key={post.id} className={post.id === selected ? "ring-2 ring-primary" : undefined}>
            <CardContent className="flex flex-col gap-3 pt-4">
              {editing === post.id ? (
                <SupplierPostForm
                  initial={post}
                  submitLabel="Save changes"
                  onCancel={() => setEditing(null)}
                  onSubmit={async (formData) => {
                    const fields = Object.fromEntries(
                      [...formData.entries()].filter(
                        (entry): entry is [string, string] => typeof entry[1] === "string",
                      ),
                    );
                    const result = await updateSupplierPost(post.id, fields);
                    if (result.error) {
                      toast.error(result.error);
                      return false;
                    }
                    toast.success("Changes saved.");
                    setEditing(null);
                    return true;
                  }}
                />
              ) : (
                <SupplierPostDetails post={post} />
              )}
              {editing !== post.id ? (
                <div className="flex flex-wrap gap-2">
                  {post.state === "posted" ? (
                    <Button size="sm" variant="outline" onClick={() => setEditing(post.id)}>
                      Edit
                    </Button>
                  ) : null}
                  {post.state !== "assigned" ? (
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => withdraw(post)}>
                      Withdraw
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </section>

      {history.length > 0 ? (
        <section className="flex flex-col gap-3" aria-label="History">
          <h2 className="font-medium tracking-tight">History</h2>
          {history.map((post) => (
            <Card key={post.id} className={post.id === selected ? "ring-2 ring-primary" : undefined}>
              <CardContent className="pt-4">
                <SupplierPostDetails post={post} />
              </CardContent>
            </Card>
          ))}
        </section>
      ) : null}
    </div>
  );
}
