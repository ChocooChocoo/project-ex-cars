"use client";

import { useRef, useState } from "react";

import { toast } from "sonner";

import { approveSupplier, createSupplier, uploadSupplierDocument, verifySupplierDocument } from "@/app/auth/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ACCEPTED_ID_TYPES, ID_LABELS } from "@/lib/auth/roles";

interface Supplier {
  id: string;
  business_name: string;
  supplier_kind: string;
  state: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
}

interface SupplierDocument {
  id: string;
  supplier_id: string;
  document_kind: string;
  is_primary_id: boolean;
  storage_path: string;
  verification_state: string;
  verified_at: string | null;
}

const KIND_LABELS: Record<string, string> = { ...ID_LABELS, general: "General Document" };

export function SupplierAdmin({
  suppliers: initialSuppliers,
  documents: initialDocuments,
  userId,
}: {
  readonly suppliers: Supplier[];
  readonly documents: SupplierDocument[];
  readonly userId: string;
}) {
  const [suppliers, setSuppliers] = useState(initialSuppliers);
  const [documents, setDocuments] = useState(initialDocuments);
  const [open, setOpen] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [supplierKind, setSupplierKind] = useState("company");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [creating, setCreating] = useState(false);

  const [docsSupplierId, setDocsSupplierId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadKind, setUploadKind] = useState<string>("drivers_license");
  const [uploadPrimary, setUploadPrimary] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const docsFor = (supplierId: string) => documents.filter((d) => d.supplier_id === supplierId);
  const verifiedPrimaryCount = (supplierId: string) =>
    docsFor(supplierId).filter((d) => d.is_primary_id && d.verification_state === "verified").length;
  const docsSupplier = suppliers.find((s) => s.id === docsSupplierId) ?? null;

  async function handleCreate() {
    if (!businessName.trim() || !contactName.trim() || !contactEmail.trim()) {
      toast.error("Business name, contact name, and email are required.");
      return;
    }

    setCreating(true);
    const result = await createSupplier({
      supplierKind,
      businessName: businessName.trim(),
      contactName: contactName.trim(),
      contactEmail: contactEmail.trim(),
      contactPhone: contactPhone.trim(),
      createdBy: userId,
    });

    setCreating(false);

    if (result.error) {
      toast.error(result.error);
    } else if (result.id) {
      setSuppliers((prev) => [
        {
          id: result.id as string,
          business_name: businessName.trim(),
          supplier_kind: supplierKind,
          state: "pending_approval",
          contact_name: contactName.trim(),
          contact_email: contactEmail.trim(),
          contact_phone: contactPhone.trim(),
        },
        ...prev,
      ]);
      setBusinessName("");
      setContactName("");
      setContactEmail("");
      setContactPhone("");
      setOpen(false);
      toast.success("Supplier created. Upload two primary IDs before approving.");
    }
  }

  async function handleDecision(supplierId: string, decision: string) {
    const result = await approveSupplier({ supplierId, approvedBy: userId, decision });
    if (result.error) {
      toast.error(result.error);
    } else {
      setSuppliers((prev) =>
        prev.map((s) => (s.id === supplierId ? { ...s, state: decision === "approved" ? "approved" : "rejected" } : s)),
      );
      toast.success(`Supplier ${decision}.`);
    }
  }

  async function handleUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!docsSupplierId || !file) {
      toast.error("Select a file to upload.");
      return;
    }
    setUploading(true);
    const formData = new FormData();
    formData.append("supplier_id", docsSupplierId);
    formData.append("document_kind", uploadKind);
    formData.append("is_primary_id", uploadPrimary ? "true" : "false");
    formData.append("file", file);
    const result = await uploadSupplierDocument(formData);
    setUploading(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Document uploaded.");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleVerify(documentId: string, decision: "verified" | "rejected") {
    const result = await verifySupplierDocument({ documentId, decision, verifiedBy: userId });
    if (result.error) {
      toast.error(result.error);
    } else {
      setDocuments((prev) =>
        prev.map((d) =>
          d.id === documentId ? { ...d, verification_state: decision, verified_at: new Date().toISOString() } : d,
        ),
      );
      toast.success(`Document ${decision}.`);
    }
  }

  const badgeVariant = (state: string) => {
    if (state === "approved") return "default";
    if (state === "rejected") return "destructive";
    return "secondary";
  };

  const docBadgeVariant = (state: string) => {
    if (state === "verified") return "default";
    if (state === "rejected") return "destructive";
    return "secondary";
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-3xl tracking-tight">Suppliers</h1>
          <p className="text-muted-foreground text-sm">Manage supplier accounts, KYC documents, and approvals.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">Create Supplier</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Supplier</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="supplier-kind">Type</Label>
                <Select value={supplierKind} onValueChange={setSupplierKind}>
                  <SelectTrigger id="supplier-kind">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="company">Company</SelectItem>
                      <SelectItem value="individual">Individual</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="business-name">Business Name</Label>
                <Input
                  id="business-name"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="ABC Auto Parts"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="contact-name">Contact Name</Label>
                <Input
                  id="contact-name"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Juan Dela Cruz"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="contact-email">Contact Email</Label>
                <Input
                  id="contact-email"
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="supplier@example.com"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="contact-phone">Contact Phone</Label>
                <Input
                  id="contact-phone"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+63 912 345 6789"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={creating}>
                {creating ? "Creating..." : "Create Supplier"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Suppliers</CardTitle>
        </CardHeader>
        <CardContent>
          {suppliers.length === 0 ? (
            <p className="text-muted-foreground text-sm">No suppliers registered.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.business_name}</TableCell>
                    <TableCell className="capitalize">{s.supplier_kind}</TableCell>
                    <TableCell>
                      <div className="text-sm">{s.contact_name}</div>
                      <div className="text-muted-foreground text-xs">{s.contact_email}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge variant={badgeVariant(s.state)}>{s.state.replace(/_/g, " ")}</Badge>
                        {s.state === "pending_approval" && (
                          <span className="text-muted-foreground text-xs">
                            {verifiedPrimaryCount(s.id)}/2 primary IDs verified
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setDocsSupplierId(s.id)}>
                          Documents
                        </Button>
                        {s.state === "pending_approval" && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => handleDecision(s.id, "approved")}
                              disabled={verifiedPrimaryCount(s.id) < 2}
                              title={
                                verifiedPrimaryCount(s.id) < 2
                                  ? "Two primary valid IDs must be verified before approval."
                                  : undefined
                              }
                            >
                              Approve
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleDecision(s.id, "rejected")}>
                              Reject
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={docsSupplierId !== null} onOpenChange={(v) => !v && setDocsSupplierId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Supplier Documents — {docsSupplier?.business_name ?? ""}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              {docsFor(docsSupplierId ?? "").length === 0 ? (
                <p className="text-muted-foreground text-sm">No documents uploaded yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Document</TableHead>
                      <TableHead>Primary ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {docsFor(docsSupplierId ?? "").map((d) => (
                      <TableRow key={d.id}>
                        <TableCell>{KIND_LABELS[d.document_kind] ?? d.document_kind}</TableCell>
                        <TableCell>{d.is_primary_id ? "Yes" : "No"}</TableCell>
                        <TableCell>
                          <Badge variant={docBadgeVariant(d.verification_state)}>{d.verification_state}</Badge>
                        </TableCell>
                        <TableCell>
                          {d.verification_state === "pending" ? (
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => handleVerify(d.id, "verified")}>
                                Verify
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handleVerify(d.id, "rejected")}>
                                Reject
                              </Button>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">
                              {d.verified_at ? `Reviewed ${new Date(d.verified_at).toLocaleDateString()}` : ""}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
            <div className="flex flex-col gap-3 rounded-lg border p-4">
              <p className="text-sm font-medium">Upload Document</p>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="doc-kind">Document Type</Label>
                <Select value={uploadKind} onValueChange={setUploadKind}>
                  <SelectTrigger id="doc-kind">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {ACCEPTED_ID_TYPES.map((kind) => (
                        <SelectItem key={kind} value={kind}>
                          {ID_LABELS[kind]}
                        </SelectItem>
                      ))}
                      <SelectItem value="general">General Document</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={uploadPrimary}
                  onChange={(e) => setUploadPrimary(e.target.checked)}
                  className="size-4"
                />
                Counts as one of the two primary valid IDs
              </label>
              <Input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" />
              <Button onClick={handleUpload} disabled={uploading}>
                {uploading ? "Uploading..." : "Upload"}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDocsSupplierId(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
