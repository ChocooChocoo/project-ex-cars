"use client";

import { useState } from "react";

import { toast } from "sonner";

import { createWalkInAccount } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function WalkInForm() {
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);

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
      createdBy: "staff",
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
