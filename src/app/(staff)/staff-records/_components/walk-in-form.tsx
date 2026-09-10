"use client";

import { useEffect, useState } from "react";

import { toast } from "sonner";

import { createWalkInAccount } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function WalkInForm({ initialOpen = false }: { readonly initialOpen?: boolean }) {
  const [open, setOpen] = useState(initialOpen);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);

  // The deep link (/staff-records?createWalkIn=1) can be followed from an
  // already-mounted page, where client state survives the soft navigation and
  // the initializer above never re-runs. Sync the controlled dialog so the
  // Account Manager's Create Walk-In entry always opens it.
  useEffect(() => {
    if (initialOpen) setOpen(true);
  }, [initialOpen]);

  async function handleCreate() {
    if (!fullName.trim() || !email.trim() || !password.trim()) {
      toast.error("All fields are required.");
      return;
    }

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }

    setCreating(true);
    const result = await createWalkInAccount({
      fullName: fullName.trim(),
      email: email.trim(),
      password: password.trim(),
    });

    setCreating(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Walk-in account created.");
      setFullName("");
      setEmail("");
      setPassword("");
      setOpen(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Create Walk-in Account
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Walk-in Account</DialogTitle>
          <DialogDescription>Creating walk-in accounts is an Account Manager responsibility.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="walkin-name">Full Name</Label>
            <Input
              id="walkin-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Juan Dela Cruz"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="walkin-email">Email</Label>
            <Input
              id="walkin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="customer@example.com"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="walkin-password">Password</Label>
            <Input
              id="walkin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={creating}>
            {creating ? "Creating..." : "Create Account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
