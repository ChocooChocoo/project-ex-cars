"use client";

import { useState } from "react";

import { toast } from "sonner";

import { approveSupplier, createSupplier } from "@/app/auth/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Supplier {
  id: string;
  business_name: string;
  supplier_kind: string;
  state: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
}

export function SupplierAdmin({
  suppliers: initialSuppliers,
  userId,
}: {
  readonly suppliers: Supplier[];
  readonly userId: string;
}) {
  const [suppliers, setSuppliers] = useState(initialSuppliers);
  const [open, setOpen] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [supplierKind, setSupplierKind] = useState("company");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [creating, setCreating] = useState(false);

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
      toast.success("Supplier created.");
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

  const badgeVariant = (state: string) => {
    if (state === "approved") return "default";
    if (state === "rejected") return "destructive";
    return "secondary";
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-3xl tracking-tight">Suppliers</h1>
          <p className="text-muted-foreground text-sm">Manage supplier accounts and approvals.</p>
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
                      <Badge variant={badgeVariant(s.state)}>{s.state.replace(/_/g, " ")}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {s.state === "pending_approval" && (
                          <>
                            <Button size="sm" onClick={() => handleDecision(s.id, "approved")}>
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
    </div>
  );
}
