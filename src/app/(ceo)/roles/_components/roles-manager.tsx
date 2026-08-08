"use client";

import { useState } from "react";

import { toast } from "sonner";

import { assignRole } from "@/app/(auth)/actions";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { GCE_ROLES, type GceRole, ROLE_LABELS } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/client";

interface UserRecord {
  id: string;
  fullName: string;
  accountState: string;
  role: string;
  createdAt: string;
}

export function RolesManager({ users }: { readonly users: UserRecord[] }) {
  const [userList, setUserList] = useState(users);
  const [loading, setLoading] = useState<string | null>(null);
  const supabase = createClient();

  async function handleRoleChange(accountId: string, newRole: string) {
    setLoading(accountId);
    const { data: currentUser } = await supabase.auth.getUser();

    if (!currentUser.user) {
      toast.error("Not authenticated");
      setLoading(null);
      return;
    }

    const result = await assignRole({
      accountId,
      role: newRole,
      assignedBy: currentUser.user.id,
    });

    if (result.error) {
      toast.error(result.error);
      setLoading(null);
      return;
    }

    setUserList((prev) => prev.map((u) => (u.id === accountId ? { ...u, role: newRole } : u)));
    toast.success("Role updated");
    setLoading(null);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-bold text-2xl">Role Management</h1>
        <p className="text-muted-foreground text-sm">Assign and manage user roles across the system.</p>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Current Role</TableHead>
              <TableHead>Change Role</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {userList.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.fullName}</TableCell>
                <TableCell>
                  <Badge variant={user.accountState === "active" ? "default" : "secondary"}>{user.accountState}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{ROLE_LABELS[user.role as GceRole] ?? user.role}</Badge>
                </TableCell>
                <TableCell>
                  <Select
                    value={user.role}
                    onValueChange={(value) => handleRoleChange(user.id, value)}
                    disabled={loading === user.id}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GCE_ROLES.map((role) => (
                        <SelectItem key={role} value={role}>
                          {ROLE_LABELS[role]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {new Date(user.createdAt).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
