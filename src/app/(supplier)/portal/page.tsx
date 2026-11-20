"use client";

import Link from "next/link";

import { PageSkeleton } from "@/components/page-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePageData } from "@/lib/api/use-page-data";
import { SUPPLIER_POST_STATE_LABELS, supplierPostTitle } from "@/lib/suppliers/supplier-posts";
import { formatCurrency } from "@/lib/utils";

import { SupplierAccessNotice } from "./_components/supplier-access-notice";
import { getSupplierDashboard } from "./actions";

// Notes lines 44-50: transactions with GCE, vehicles posted and vehicles purchased.
export default function SupplierDashboardPage() {
  const page = usePageData("supplier-dashboard", getSupplierDashboard);
  if (page.error) return <SupplierAccessNotice error={page.error} />;
  if (!page.data) return <PageSkeleton />;
  const { company_name, counts, posts } = page.data;
  const stats = [
    { label: "Transactions with GCE", value: counts.transactions },
    { label: "Vehicles posted", value: counts.posted },
    { label: "Vehicles purchased", value: counts.purchased },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-semibold text-3xl tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm">{company_name}</p>
        </div>
        <Button asChild size="sm">
          <Link href="/supplier/portal/vehicles">Post a vehicle</Link>
        </Button>
      </div>
      <dl className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex flex-col gap-1 pt-4">
              <dt className="text-muted-foreground text-xs">{stat.label}</dt>
              <dd className="font-semibold text-2xl tabular-nums">{stat.value}</dd>
            </CardContent>
          </Card>
        ))}
      </dl>
      <Card>
        <CardHeader>
          <CardTitle>Recent vehicles</CardTitle>
          <CardDescription>Only GCE's buying team sees your posts. They never appear in the showroom.</CardDescription>
        </CardHeader>
        <CardContent>
          {posts.length === 0 ? (
            <p className="text-muted-foreground text-sm">No vehicles posted yet.</p>
          ) : (
            <ul className="flex flex-col divide-y text-sm">
              {posts.slice(0, 8).map((post) => (
                <li key={post.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <Link href={`/supplier/portal/vehicles?post=${post.id}`} className="font-medium hover:underline">
                    {supplierPostTitle(post)}
                  </Link>
                  <span className="flex items-center gap-2">
                    <span className="text-muted-foreground tabular-nums">{formatCurrency(post.asking_price)}</span>
                    <Badge variant="outline">{SUPPLIER_POST_STATE_LABELS[post.state] ?? post.state}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
