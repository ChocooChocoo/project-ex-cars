import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentRole } from "@/app/auth/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getOwnSupplierOverview } from "@/server/supplier-overview";

export default async function SupplierOverviewPage() {
  const role = await getCurrentRole();
  if (role !== "supplier") {
    redirect("/unauthorized");
  }

  const { supplier, documents, verification } = await getOwnSupplierOverview();

  if (!supplier) {
    return (
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>No supplier record — invite pending</CardTitle>
            <CardDescription>
              Your supplier account is pending invite or approval. Contact GCE if you were invited.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Once invited, your profile and verification status will appear here.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const approvedDate = supplier.created_at ? new Date(supplier.created_at).toLocaleDateString() : "—";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl leading-none tracking-tight">My Supplier Profile</h1>
        <p className="text-muted-foreground text-sm">Your business profile, verification, and documents.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {supplier.business_name}
            <Badge variant={supplier.state === "approved" ? "default" : "secondary"}>{supplier.state}</Badge>
          </CardTitle>
          <CardDescription>
            {supplier.supplier_kind} · Approved date: {approvedDate}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 text-sm">
          {supplier.contact_name && <span>{supplier.contact_name}</span>}
          {supplier.contact_email && <span className="text-muted-foreground">{supplier.contact_email}</span>}
          {supplier.contact_phone && <span className="text-muted-foreground">{supplier.contact_phone}</span>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Verification</CardTitle>
          <CardDescription>
            {verification.verifiedPrimary} of {verification.required} primary IDs verified
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-2 w-full overflow-hidden rounded bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${Math.min(100, (verification.verifiedPrimary / verification.required) * 100)}%` }}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Documents</CardTitle>
          <CardDescription>
            {documents.length === 0 ? "No documents yet." : `${documents.length} document(s) on file.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {documents.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
              <span className="flex items-center gap-2">
                {doc.document_kind}
                {doc.is_primary_id && <Badge variant="outline">primary</Badge>}
              </span>
              <Badge variant={doc.verification_state === "verified" ? "default" : "secondary"}>
                {doc.verification_state}
              </Badge>
            </div>
          ))}
          <Button asChild variant="outline" className="mt-2 w-fit">
            <Link href="/supplier/supplier-messages">Open Messages</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
