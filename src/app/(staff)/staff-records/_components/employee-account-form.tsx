"use client";

import { useState } from "react";

import { toast } from "sonner";

import { createEmployeeAccount } from "@/app/auth/actions";
import { PasswordInput } from "@/components/password-input";
import { PasswordRules } from "@/components/password-rules";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EMPLOYEE_ROLES, ROLE_LABELS } from "@/lib/auth/roles";
import { newPasswordSchema } from "@/lib/validation/forms";

// T04 E6: the CEO or the Account Manager creates an account for a new employee.
export function EmployeeAccountForm() {
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("");
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    if (!fullName.trim() || !email.trim() || !password.trim() || !role) {
      toast.error("All fields are required.");
      return;
    }
    const passwordCheck = newPasswordSchema.safeParse(password.trim());
    if (!passwordCheck.success) {
      toast.error(passwordCheck.error.issues[0]?.message ?? "Choose a stronger password.");
      return;
    }

    setCreating(true);
    const result = await createEmployeeAccount({
      fullName: fullName.trim(),
      email: email.trim(),
      password: password.trim(),
      role,
    });
    setCreating(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(`${ROLE_LABELS[role as keyof typeof ROLE_LABELS]} account created.`);
    setFullName("");
    setEmail("");
    setPassword("");
    setRole("");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Create Employee Account</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Employee Account</DialogTitle>
          <DialogDescription>
            The employee signs in with this email and temporary password, then changes the password on their profile.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="employee-name">Full Name</Label>
            <Input id="employee-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="employee-email">Email</Label>
            <Input
              id="employee-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@gce.local"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="employee-role">Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger id="employee-role" className="w-full">
                <SelectValue placeholder="Choose a role" />
              </SelectTrigger>
              <SelectContent>
                {EMPLOYEE_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="employee-password">Temporary Password</Label>
            <PasswordInput
              id="employee-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              aria-describedby="employee-password-rules"
            />
            <PasswordRules id="employee-password-rules" value={password} />
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
