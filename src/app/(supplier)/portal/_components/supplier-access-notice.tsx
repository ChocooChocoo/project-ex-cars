"use client";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError } from "@/lib/api/errors";

/** A pending or rejected supplier gets 403 from Laravel; the portal says why instead of an error page. */
export function SupplierAccessNotice({ error }: { readonly error: unknown }) {
  if (!(error instanceof ApiError) || error.status !== 403) throw error;
  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Supplier portal</CardTitle>
        <CardDescription>{error.message}</CardDescription>
      </CardHeader>
    </Card>
  );
}
