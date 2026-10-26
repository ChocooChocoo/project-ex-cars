"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { toast } from "sonner";

import { changeOwnPassword, updateOwnProfile } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export interface OwnProfile {
  readonly email: string;
  readonly full_name: string;
  readonly phone: string;
  readonly address: string;
}

function DetailsCard({ profile }: { readonly profile: OwnProfile }) {
  const router = useRouter();
  const [fullName, setFullName] = useState(profile.full_name);
  const [phone, setPhone] = useState(profile.phone);
  const [address, setAddress] = useState(profile.address);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const changed = fullName !== profile.full_name || phone !== profile.phone || address !== profile.address;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const fd = new FormData();
    fd.set("full_name", fullName);
    fd.set("phone", phone);
    fd.set("address", address);
    const result = await updateOwnProfile(fd);
    setSaving(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    toast.success("Profile saved.");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Personal details</CardTitle>
        <CardDescription>Used to fill in your transactions and to contact you.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="profile-email">Email</FieldLabel>
            <Input id="profile-email" value={profile.email} readOnly disabled />
            <FieldDescription>Contact GCE to change the email you sign in with.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="profile-name">Full name *</FieldLabel>
            <Input
              id="profile-name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              autoComplete="name"
              required
              maxLength={100}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="profile-phone">Phone</FieldLabel>
            <Input
              id="profile-phone"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              autoComplete="tel"
              placeholder="09171234567"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="profile-address">Address</FieldLabel>
            <Textarea
              id="profile-address"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              autoComplete="street-address"
              rows={3}
              maxLength={500}
            />
          </Field>
          {error ? (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end">
            <Button type="submit" disabled={saving || !changed}>
              {saving ? "Saving..." : "Save details"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function PasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const fd = new FormData();
    fd.set("current_password", current);
    fd.set("new_password", next);
    fd.set("confirm_password", confirm);
    const result = await changeOwnPassword(fd);
    setSaving(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setCurrent("");
    setNext("");
    setConfirm("");
    toast.success("Password changed.");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Password</CardTitle>
        <CardDescription>At least 8 characters.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="password-current">Current password</FieldLabel>
            <Input
              id="password-current"
              type="password"
              value={current}
              onChange={(event) => setCurrent(event.target.value)}
              autoComplete="current-password"
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="password-new">New password</FieldLabel>
            <Input
              id="password-new"
              type="password"
              value={next}
              onChange={(event) => setNext(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </Field>
          <Field data-invalid={!!confirm && confirm !== next}>
            <FieldLabel htmlFor="password-confirm">Confirm new password</FieldLabel>
            <Input
              id="password-confirm"
              type="password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              autoComplete="new-password"
              aria-invalid={!!confirm && confirm !== next}
              required
            />
            {confirm && confirm !== next ? <FieldError errors={[{ message: "The passwords do not match." }]} /> : null}
          </Field>
          {error ? (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end">
            <Button type="submit" disabled={saving || !current || !next || next !== confirm}>
              {saving ? "Changing..." : "Change password"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// T03 C15: one profile page for every role; the customer and staff routes render this.
export function ProfileForms({ profile }: { readonly profile: OwnProfile }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl leading-none tracking-tight">Profile</h1>
        <p className="text-muted-foreground text-sm">Your details and password.</p>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <DetailsCard profile={profile} />
        <PasswordCard />
      </div>
    </div>
  );
}
