"use client";

import { useMemo, useState } from "react";

import { useRouter } from "next/navigation";

import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RBAC_MANAGED_ROLES, type RbacManagedRole, ROLE_LABELS } from "@/lib/auth/roles";

import { createRbacPermission, createRbacRole, updateRbacRole } from "../actions";

export interface RbacCatalogOption {
  key: string;
  label: string;
  sortOrder: number;
}

export interface RbacPermission {
  id: string;
  accessAreaKey: string;
  actionKey: string;
  accessLabel: string;
  permissionKey: string;
  description: string | null;
  status: "active" | "inactive";
}

export interface RbacRole {
  roleKey: RbacManagedRole;
  description: string | null;
  status: "active" | "inactive";
  isProtected: boolean;
  permissionIds: string[];
}

interface UserRecord {
  id: string;
  fullName: string;
  accountState: string;
  role: string;
  createdAt: string;
}

interface RolesProps {
  roles: RbacRole[];
  permissions: RbacPermission[];
  accessAreas: RbacCatalogOption[];
  actions: RbacCatalogOption[];
  users: UserRecord[];
  dataError?: string | null;
}

const statuses = ["active", "inactive"] as const;

export function buildPermissionPreview(
  accessAreaKey: string,
  actionKey: string,
  accessAreas: RbacCatalogOption[],
  actions: RbacCatalogOption[],
) {
  const area = accessAreas.find((item) => item.key === accessAreaKey);
  const action = actions.find((item) => item.key === actionKey);
  return {
    accessLabel: area && action ? `${action.label} ${area.label}` : "—",
    permissionKey: area && action ? `${area.key}.${action.key}` : "—",
  };
}

function resultError(result: { error?: string | null } | { success: true }) {
  if ("error" in result && result.error) toast.error(result.error);
  return "error" in result && Boolean(result.error);
}

export function Roles({ roles, permissions, accessAreas, actions, dataError }: RolesProps) {
  const router = useRouter();
  const [createRoleOpen, setCreateRoleOpen] = useState(false);
  const [createPermissionOpen, setCreatePermissionOpen] = useState(false);
  const [editRole, setEditRole] = useState<RbacRole | null>(null);
  const [roleKey, setRoleKey] = useState<RbacManagedRole | "">("");
  const [roleDescription, setRoleDescription] = useState("");
  const [roleStatus, setRoleStatus] = useState<(typeof statuses)[number]>("active");
  const [roleProtected, setRoleProtected] = useState(false);
  const [permissionIds, setPermissionIds] = useState<string[]>([]);
  const [permissionArea, setPermissionArea] = useState("");
  const [permissionAction, setPermissionAction] = useState("");
  const [permissionDescription, setPermissionDescription] = useState("");
  const [permissionStatus, setPermissionStatus] = useState<(typeof statuses)[number]>("active");

  const availableRoleKeys = RBAC_MANAGED_ROLES.filter((key) => !roles.some((role) => role.roleKey === key));
  const existingPermissionKeys = useMemo(
    () => new Set(permissions.map((permission) => permission.permissionKey)),
    [permissions],
  );
  const preview = buildPermissionPreview(permissionArea, permissionAction, accessAreas, actions);
  const activePermissions = permissions.filter((permission) => permission.status === "active");

  function openEditRole(role: RbacRole) {
    setEditRole(role);
    setRoleDescription(role.description ?? "");
    setRoleStatus(role.status);
    setRoleProtected(role.isProtected);
    setPermissionIds(role.permissionIds.filter((id) => activePermissions.some((permission) => permission.id === id)));
  }

  function closeEditRole(open: boolean) {
    if (!open) setEditRole(null);
  }

  function setRoleDialog(open: boolean) {
    setCreateRoleOpen(open);
    if (!open) {
      setRoleKey("");
      setRoleDescription("");
      setRoleStatus("active");
      setRoleProtected(false);
    }
  }

  function setPermissionDialog(open: boolean) {
    setCreatePermissionOpen(open);
    if (!open) {
      setPermissionArea("");
      setPermissionAction("");
      setPermissionDescription("");
      setPermissionStatus("active");
    }
  }

  async function submitRole(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const result = await createRbacRole(formData);
    if (resultError(result)) return;
    toast.success("Role created");
    setRoleDialog(false);
    router.refresh();
  }

  async function submitPermission(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const result = await createRbacPermission(formData);
    if (resultError(result)) return;
    toast.success("Permission created");
    setPermissionDialog(false);
    router.refresh();
  }

  async function submitRoleUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editRole) return;
    const formData = new FormData(event.currentTarget);
    formData.set("roleKey", editRole.roleKey);
    permissionIds.forEach((id) => {
      formData.append("permissionIds", id);
    });
    const result = await updateRbacRole(formData);
    if (resultError(result)) return;
    toast.success("Role updated");
    setEditRole(null);
    router.refresh();
  }

  function togglePermission(id: string, checked: boolean) {
    setPermissionIds((current) => (checked ? [...new Set([...current, id])] : current.filter((value) => value !== id)));
  }

  function toggleArea(areaKey: string, checked: boolean) {
    const areaIds = activePermissions
      .filter((permission) => permission.accessAreaKey === areaKey)
      .map((permission) => permission.id);
    setPermissionIds((current) => {
      if (checked) return [...new Set([...current, ...areaIds])];
      return current.filter((id) => !areaIds.includes(id));
    });
  }

  return (
    <div className="flex h-full flex-col gap-6">
      <div>
        <h1 className="text-3xl tracking-tight">Roles & Permissions</h1>
        <p className="text-muted-foreground text-sm">Manage role definitions and permission metadata.</p>
      </div>

      {dataError ? (
        <p
          className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-destructive text-sm"
          role="alert"
        >
          {dataError}
        </p>
      ) : null}

      <Tabs className="flex-1" defaultValue="roles">
        <TabsList
          variant="line"
          className="w-full justify-start gap-2 border-b ps-0 *:data-[slot=tabs-trigger]:flex-none"
        >
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="permission">Permission</TabsTrigger>
        </TabsList>

        <TabsContent value="roles" className="space-y-8 pt-4">
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-semibold text-lg">Role definitions</h2>
                <p className="text-muted-foreground text-sm">Create managed roles and assign metadata permissions.</p>
              </div>
              <Dialog open={createRoleOpen} onOpenChange={setRoleDialog}>
                <DialogTrigger asChild>
                  <Button disabled={Boolean(dataError) || availableRoleKeys.length === 0}>
                    <Plus data-icon="inline-start" />
                    Create Role
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Role</DialogTitle>
                    <DialogDescription>Choose one of the canonical system roles.</DialogDescription>
                  </DialogHeader>
                  <form className="space-y-4" onSubmit={submitRole}>
                    <div className="space-y-2">
                      <Label htmlFor="role-label">Role Label</Label>
                      <select
                        className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                        id="role-label"
                        name="roleKey"
                        onChange={(event) => setRoleKey(event.target.value as RbacManagedRole | "")}
                        required
                        value={roleKey}
                      >
                        <option value="">Select a role</option>
                        {availableRoleKeys.map((key) => (
                          <option key={key} value={key}>
                            {ROLE_LABELS[key]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role-key">System Role Key</Label>
                      <Input id="role-key" readOnly value={roleKey} aria-label="System Role Key" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role-description">Description</Label>
                      <textarea
                        className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm"
                        id="role-description"
                        name="description"
                        onChange={(event) => setRoleDescription(event.target.value)}
                        value={roleDescription}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role-status">Status</Label>
                      <select
                        className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                        id="role-status"
                        name="status"
                        onChange={(event) => setRoleStatus(event.target.value as (typeof statuses)[number])}
                        value={roleStatus}
                      >
                        {statuses.map((status) => (
                          <option key={status}>{status}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center justify-between rounded-md border p-3">
                      <Label htmlFor="role-protected">Protected System Role</Label>
                      <Switch checked={roleProtected} id="role-protected" onCheckedChange={setRoleProtected} />
                      <input name="isProtected" type="hidden" value={roleProtected ? "true" : "false"} />
                    </div>
                    <DialogFooter>
                      <Button type="submit">Create Role</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
            <div className="overflow-hidden rounded-md border">
              <Table className="min-w-[1060px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-44">Role</TableHead>
                    <TableHead className="min-w-56">System Role Key</TableHead>
                    <TableHead className="min-w-24">Status</TableHead>
                    <TableHead className="min-w-24">Protected</TableHead>
                    <TableHead className="min-w-32">Permissions</TableHead>
                    <TableHead className="min-w-28 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roles.length ? (
                    roles.map((role) => (
                      <TableRow key={role.roleKey}>
                        <TableCell className="min-w-44 font-medium">{ROLE_LABELS[role.roleKey]}</TableCell>
                        <TableCell className="min-w-56 font-mono text-xs">{role.roleKey}</TableCell>
                        <TableCell className="min-w-24">
                          <Badge variant={role.status === "active" ? "default" : "secondary"}>{role.status}</Badge>
                        </TableCell>
                        <TableCell className="min-w-24">{role.isProtected ? "Yes" : "No"}</TableCell>
                        <TableCell className="min-w-32">
                          {
                            role.permissionIds.filter((id) =>
                              activePermissions.some((permission) => permission.id === id),
                            ).length
                          }{" "}
                          assigned
                        </TableCell>
                        <TableCell className="min-w-28 text-right">
                          <Button
                            aria-label={`Edit ${ROLE_LABELS[role.roleKey]}`}
                            onClick={() => openEditRole(role)}
                            size="sm"
                            variant="outline"
                          >
                            <Pencil data-icon="inline-start" />
                            Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell className="h-24 text-center text-muted-foreground" colSpan={6}>
                        No roles created yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </section>
        </TabsContent>

        <TabsContent value="permission" className="space-y-4 pt-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold text-lg">Permission</h2>
              <p className="text-muted-foreground text-sm">Define the fixed access-area and action combinations.</p>
            </div>
            <Dialog open={createPermissionOpen} onOpenChange={setPermissionDialog}>
              <DialogTrigger asChild>
                <Button disabled={Boolean(dataError)}>
                  <Plus data-icon="inline-start" />
                  Add Permission
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Permission</DialogTitle>
                  <DialogDescription>
                    Permission keys and labels are generated from the selected catalogs.
                  </DialogDescription>
                </DialogHeader>
                <form className="space-y-4" onSubmit={submitPermission}>
                  <div className="space-y-2">
                    <Label htmlFor="permission-area">Access Area</Label>
                    <select
                      className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                      id="permission-area"
                      name="accessAreaKey"
                      onChange={(event) => setPermissionArea(event.target.value)}
                      required
                      value={permissionArea}
                    >
                      <option value="">Select an access area</option>
                      {accessAreas.map((area) => (
                        <option key={area.key} value={area.key}>
                          {area.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="permission-action">Allowed Action</Label>
                    <select
                      className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                      id="permission-action"
                      name="actionKey"
                      onChange={(event) => setPermissionAction(event.target.value)}
                      required
                      value={permissionAction}
                    >
                      <option value="">Select an action</option>
                      {actions.map((action) => {
                        const key = permissionArea ? `${permissionArea}.${action.key}` : "";
                        return (
                          <option
                            disabled={Boolean(key && existingPermissionKeys.has(key))}
                            key={action.key}
                            value={action.key}
                          >
                            {action.label}
                            {key && existingPermissionKeys.has(key) ? " (created)" : ""}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="permission-label-preview">Access Label Preview</Label>
                    <Input
                      aria-label="Access Label Preview"
                      id="permission-label-preview"
                      readOnly
                      value={preview.accessLabel}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="permission-key-preview">System Permission Key</Label>
                    <Input
                      aria-label="System Permission Key"
                      id="permission-key-preview"
                      readOnly
                      value={preview.permissionKey}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="permission-description">Description</Label>
                    <textarea
                      className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm"
                      id="permission-description"
                      name="description"
                      onChange={(event) => setPermissionDescription(event.target.value)}
                      value={permissionDescription}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="permission-status">Status</Label>
                    <select
                      className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                      id="permission-status"
                      name="status"
                      onChange={(event) => setPermissionStatus(event.target.value as (typeof statuses)[number])}
                      value={permissionStatus}
                    >
                      {statuses.map((status) => (
                        <option key={status}>{status}</option>
                      ))}
                    </select>
                  </div>
                  <DialogFooter>
                    <Button type="submit">Add Permission</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
          <div className="overflow-hidden rounded-md border">
            <Table className="min-w-[720px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Access Label</TableHead>
                  <TableHead>System Permission Key</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {permissions.length ? (
                  permissions.map((permission) => (
                    <TableRow key={permission.id}>
                      <TableCell className="min-w-52 font-medium">{permission.accessLabel}</TableCell>
                      <TableCell className="font-mono text-xs">{permission.permissionKey}</TableCell>
                      <TableCell className="min-w-64 whitespace-normal break-words text-muted-foreground">
                        {permission.description || "—"}
                      </TableCell>
                      <TableCell className="min-w-24">
                        <Badge variant={permission.status === "active" ? "default" : "secondary"}>
                          {permission.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell className="h-24 text-center text-muted-foreground" colSpan={4}>
                      No permissions created yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(editRole)} onOpenChange={closeEditRole}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Edit Role{editRole ? `: ${ROLE_LABELS[editRole.roleKey]}` : ""}</DialogTitle>
            <DialogDescription>
              Update metadata and replace the active permission assignments atomically.
            </DialogDescription>
          </DialogHeader>
          {editRole ? (
            <form className="space-y-5" onSubmit={submitRoleUpdate}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-role-label">Role Label</Label>
                  <Input id="edit-role-label" readOnly value={ROLE_LABELS[editRole.roleKey]} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-role-key">System Role Key</Label>
                  <Input id="edit-role-key" readOnly value={editRole.roleKey} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-role-description">Description</Label>
                <textarea
                  className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm"
                  id="edit-role-description"
                  name="description"
                  onChange={(event) => setRoleDescription(event.target.value)}
                  value={roleDescription}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-role-status">Status</Label>
                  <Select
                    value={roleStatus}
                    onValueChange={(value) => setRoleStatus(value as (typeof statuses)[number])}
                  >
                    <SelectTrigger className="w-full" id="edit-role-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      {statuses.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <input name="status" type="hidden" value={roleStatus} />
                </div>
                <div className="flex items-center justify-between rounded-md border p-3">
                  <Label htmlFor="edit-role-protected">Protected System Role</Label>
                  <Switch checked={roleProtected} id="edit-role-protected" onCheckedChange={setRoleProtected} />
                  <input name="isProtected" type="hidden" value={roleProtected ? "true" : "false"} />
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <h3 className="font-semibold">Access Items</h3>
                  <p className="text-muted-foreground text-sm">
                    {permissionIds.length} of {activePermissions.length} assigned
                  </p>
                </div>
                <div className="space-y-4">
                  {accessAreas.map((area) => {
                    const areaPermissions = activePermissions.filter(
                      (permission) => permission.accessAreaKey === area.key,
                    );
                    if (!areaPermissions.length) return null;
                    const selectedCount = areaPermissions.filter((permission) =>
                      permissionIds.includes(permission.id),
                    ).length;
                    return (
                      <div className="rounded-md border p-3" key={area.key}>
                        <div className="mb-3 flex items-center justify-between">
                          <h4 className="font-medium">
                            {area.label}{" "}
                            <span className="font-normal text-muted-foreground text-sm">
                              ({selectedCount} of {areaPermissions.length} assigned)
                            </span>
                          </h4>
                          <div className="flex items-center gap-2 text-sm">
                            <Checkbox
                              aria-label={`Select all ${area.label} permissions`}
                              checked={selectedCount === areaPermissions.length}
                              id={`select-all-${area.key}`}
                              onCheckedChange={(checked) => toggleArea(area.key, checked === true)}
                            />
                            <Label htmlFor={`select-all-${area.key}`}>Select All</Label>
                          </div>
                        </div>
                        <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-2">
                          {areaPermissions.map((permission) => (
                            <div className="flex min-w-0 items-start gap-2 text-sm" key={permission.id}>
                              <Checkbox
                                checked={permissionIds.includes(permission.id)}
                                id={`permission-${permission.id}`}
                                onCheckedChange={(checked) => togglePermission(permission.id, checked === true)}
                              />
                              <Label
                                className="min-w-0 flex-col items-start gap-0 text-left font-normal"
                                htmlFor={`permission-${permission.id}`}
                              >
                                <span className="block max-w-full font-medium leading-5">{permission.accessLabel}</span>
                                <span className="block max-w-full break-words text-muted-foreground">
                                  {permission.description || permission.permissionKey}
                                </span>
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">Save Changes</Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
