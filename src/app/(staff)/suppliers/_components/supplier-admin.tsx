"use client";

import { useMemo, useRef, useState } from "react";

import type { ColumnDef } from "@tanstack/react-table";
import {
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type PaginationState,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { Check, Eye, MoreHorizontal, Plus, ScanFace, X } from "lucide-react";
import { toast } from "sonner";

import { approveSupplier, createSupplier, uploadSupplierDocument, verifySupplierDocument } from "@/app/auth/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
  const [createOpen, setCreateOpen] = useState(false);
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

  const [approveTarget, setApproveTarget] = useState<{ supplier: Supplier; decision: "approved" | "rejected" } | null>(
    null,
  );
  const [verifyTarget, setVerifyTarget] = useState<{
    document: SupplierDocument;
    decision: "verified" | "rejected";
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });

  const docsFor = useMemo(
    () => (supplierId: string) => documents.filter((d) => d.supplier_id === supplierId),
    [documents],
  );
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
      setCreateOpen(false);
      toast.success("Supplier created. Upload two primary IDs before approving.");
    }
  }

  async function handleDecision() {
    if (!approveTarget) return;
    const { supplier, decision } = approveTarget;
    setSubmitting(true);
    const result = await approveSupplier({ supplierId: supplier.id, approvedBy: userId, decision });
    setSubmitting(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setSuppliers((prev) =>
      prev.map((s) => (s.id === supplier.id ? { ...s, state: decision === "approved" ? "approved" : "rejected" } : s)),
    );
    toast.success(`Supplier ${decision}.`);
    setApproveTarget(null);
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

  async function handleVerify() {
    if (!verifyTarget) return;
    const { document: doc, decision } = verifyTarget;
    setSubmitting(true);
    const result = await verifySupplierDocument({ documentId: doc.id, decision, verifiedBy: userId });
    setSubmitting(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setDocuments((prev) =>
      prev.map((d) =>
        d.id === doc.id ? { ...d, verification_state: decision, verified_at: new Date().toISOString() } : d,
      ),
    );
    toast.success(`Document ${decision}.`);
    setVerifyTarget(null);
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

  const columns: ColumnDef<Supplier>[] = [
    {
      accessorKey: "business_name",
      header: "Business Name",
      cell: ({ row }) => <span className="font-medium">{row.original.business_name}</span>,
    },
    {
      accessorKey: "supplier_kind",
      header: "Type",
      cell: ({ row }) => <span className="capitalize">{row.original.supplier_kind}</span>,
    },
    {
      accessorKey: "contact_name",
      header: "Contact",
      cell: ({ row }) => (
        <div className="grid gap-0.5">
          <span>{row.original.contact_name}</span>
          <span className="text-muted-foreground text-xs">
            {row.original.contact_email}
            {row.original.contact_phone ? ` · ${row.original.contact_phone}` : ""}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "state",
      header: "State",
      cell: ({ row }) => {
        const supplier = row.original;
        return (
          <div className="flex flex-col items-start gap-1">
            <Badge variant={badgeVariant(supplier.state)} className="capitalize">
              {supplier.state.replace(/_/g, " ")}
            </Badge>
            {supplier.state === "pending_approval" && (
              <span className="text-muted-foreground text-xs">
                {verifiedPrimaryCount(supplier.id)}/2 primary IDs verified
              </span>
            )}
          </div>
        );
      },
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const supplier = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setDocsSupplierId(supplier.id)}>
                <Eye className="mr-2 size-4" />
                View Documents
              </DropdownMenuItem>
              {supplier.state === "pending_approval" ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    disabled={verifiedPrimaryCount(supplier.id) < 2}
                    title={
                      verifiedPrimaryCount(supplier.id) < 2
                        ? "Two primary valid IDs must be verified before approval."
                        : undefined
                    }
                    onClick={() => setApproveTarget({ supplier, decision: "approved" })}
                  >
                    <Check className="mr-2 size-4" />
                    Approve
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => setApproveTarget({ supplier, decision: "rejected" })}
                  >
                    <X className="mr-2 size-4" />
                    Reject
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  const table = useReactTable({
    data: suppliers,
    columns,
    state: { sorting, pagination },
    getRowId: (row) => row.id,
    autoResetPageIndex: false,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl leading-none tracking-tight">Suppliers</h1>
          <p className="text-muted-foreground text-sm">Manage supplier accounts, KYC documents, and approvals.</p>
        </div>
        <Button size="sm" className="self-start lg:self-auto" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          Create Supplier
        </Button>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>
            <div className="flex items-center gap-2">
              <ScanFace className="size-5 text-muted-foreground" />
              All Suppliers
            </div>
          </CardTitle>
          <Badge variant="secondary" className="rounded-md">
            {suppliers.length} suppliers
          </Badge>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <DataTable table={table} rowsPerPageId="suppliers-rows-per-page" />
        </CardContent>
      </Card>

      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent className="flex max-w-md flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b">
            <SheetTitle>Create Supplier</SheetTitle>
            <p className="text-muted-foreground text-sm">
              Register a company or individual supplier. Upload two primary IDs before approval.
            </p>
          </SheetHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
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
            <Separator />
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
          <SheetFooter className="border-t">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? "Creating..." : "Create Supplier"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={docsSupplierId !== null} onOpenChange={(v) => !v && setDocsSupplierId(null)}>
        <SheetContent className="flex max-w-md flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b">
            <SheetTitle>Supplier Documents</SheetTitle>
            <p className="text-muted-foreground text-sm">{docsSupplier?.business_name ?? "—"}</p>
          </SheetHeader>
          <ScrollArea className="min-h-0 flex-1">
            <div className="flex flex-col gap-4 p-4">
              <div className="flex flex-col gap-2">
                {docsFor(docsSupplierId ?? "").length === 0 ? (
                  <p className="text-muted-foreground text-sm">No documents uploaded yet.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {docsFor(docsSupplierId ?? "").map((d) => (
                      <div key={d.id} className="flex flex-col gap-2 rounded-lg border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-sm">{KIND_LABELS[d.document_kind] ?? d.document_kind}</span>
                          <Badge variant={docBadgeVariant(d.verification_state)} className="capitalize">
                            {d.verification_state}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-muted-foreground text-xs">
                            {d.is_primary_id ? "Primary ID" : "General"}
                            {d.verified_at ? ` · Reviewed ${new Date(d.verified_at).toLocaleDateString()}` : ""}
                          </span>
                          {d.verification_state === "pending" ? (
                            <div className="flex items-center gap-2">
                              <Button size="sm" onClick={() => setVerifyTarget({ document: d, decision: "verified" })}>
                                Verify
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setVerifyTarget({ document: d, decision: "rejected" })}
                              >
                                Reject
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <Separator />
              <div className="flex flex-col gap-3 rounded-lg border p-4">
                <p className="font-medium text-sm">Upload Document</p>
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
          </ScrollArea>
          <SheetFooter className="border-t">
            <Button variant="outline" onClick={() => setDocsSupplierId(null)}>
              Close
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={approveTarget !== null}
        onOpenChange={(open) => {
          if (!open) setApproveTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {approveTarget?.decision === "approved" ? "Approve this supplier?" : "Reject this supplier?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {approveTarget ? (
                <>
                  <span className="font-medium text-foreground">“{approveTarget.supplier.business_name}”</span>{" "}
                  {approveTarget.decision === "approved"
                    ? "will be approved and can start supplying parts and services."
                    : "will be rejected and cannot supply parts or services."}{" "}
                  This action cannot be undone.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant={approveTarget?.decision === "rejected" ? "destructive" : "default"}
              onClick={handleDecision}
              disabled={submitting}
            >
              {submitting ? "Submitting..." : approveTarget?.decision === "approved" ? "Approve" : "Reject"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={verifyTarget !== null}
        onOpenChange={(open) => {
          if (!open) setVerifyTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {verifyTarget?.decision === "verified" ? "Verify this document?" : "Reject this document?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {verifyTarget ? (
                <>
                  <span className="font-medium text-foreground">
                    {KIND_LABELS[verifyTarget.document.document_kind] ?? verifyTarget.document.document_kind}
                  </span>{" "}
                  will be marked as {verifyTarget.decision}. This action cannot be undone.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant={verifyTarget?.decision === "rejected" ? "destructive" : "default"}
              onClick={handleVerify}
              disabled={submitting}
            >
              {submitting ? "Submitting..." : verifyTarget?.decision === "verified" ? "Verify" : "Reject"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
