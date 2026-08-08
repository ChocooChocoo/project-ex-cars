"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { toast } from "sonner";

import { updateAccountState, updateProfileDetails } from "@/app/(staff)/staff-records/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AccountRow {
  id: string;
  full_name: string | null;
  phone: string | null;
  address: string | null;
  account_state: string;
}

const STATE_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
  { value: "archived", label: "Archived" },
] as const;

export function AccountActionsCell({ account }: { readonly account: AccountRow }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [fullName, setFullName] = useState(account.full_name ?? "");
  const [phone, setPhone] = useState(account.phone ?? "");
  const [address, setAddress] = useState(account.address ?? "");
  const [newState, setNewState] = useState<string>(account.account_state === "active" ? "suspended" : "active");
  const [loading, setLoading] = useState(false);

  async function handleSaveDetails() {
    if (!fullName.trim()) {
      toast.error("Full name is required.");
      return;
    }
    setLoading(true);
    const fd = new FormData();
    fd.set("accountId", account.id);
    fd.set("fullName", fullName.trim());
    fd.set("phone", phone.trim());
    fd.set("address", address.trim());
    const result = await updateProfileDetails(fd);
    setLoading(false);
    if ("error" in result && result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Account details updated.");
    setEditOpen(false);
    router.refresh();
  }

  async function handleChangeState() {
    setLoading(true);
    const fd = new FormData();
    fd.set("accountId", account.id);
    fd.set("state", newState);
    const result = await updateAccountState(fd);
    setLoading(false);
    if ("error" in result && result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(`Account ${newState}.`);
    setStatusOpen(false);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline">
            Edit
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Account</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-name">Full Name</Label>
              <Input id="edit-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-phone">Phone</Label>
              <Input
                id="edit-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+63 912 345 6789"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-address">Address</Label>
              <Input id="edit-address" value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveDetails} disabled={loading}>
              {loading ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline">
            Set Status
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Account Status</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="account-state">New Status</Label>
              <Select value={newState} onValueChange={setNewState}>
                <SelectTrigger id="account-state">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {STATE_OPTIONS.filter((o) => o.value !== account.account_state).map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <p className="text-muted-foreground text-xs">
              Current status: <span className="capitalize">{account.account_state.replace(/_/g, " ")}</span>. Suspending
              blocks the account from signing in; archiving marks it as closed.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setStatusOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleChangeState} disabled={loading}>
              {loading ? "Saving..." : "Change Status"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
