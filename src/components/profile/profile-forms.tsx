"use client";

import { useRef, useState } from "react";

import { useRouter } from "next/navigation";

import { toast } from "sonner";

import {
  changeOwnPassword,
  removeOwnAvatar,
  requestEmailChange,
  updateOwnAvatar,
  updateOwnProfile,
} from "@/app/auth/actions";
import { PasswordRules } from "@/components/password-rules";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getInitials } from "@/lib/utils";

export interface OwnProfile {
  readonly email: string;
  readonly full_name: string;
  readonly phone: string;
  readonly address: string;
  readonly avatar_url: string | null;
  readonly role_label: string | null;
  readonly can_change_email: boolean;
}

function ChangeEmailDialog({ currentEmail }: { readonly currentEmail: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function reset(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) return;
    setEmail("");
    setSentTo(null);
    setError(null);
  }

  async function send(event?: React.FormEvent) {
    event?.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.set("email", sentTo ?? email);
    const result = await requestEmailChange(fd);
    setBusy(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    if (sentTo) toast.success("We sent the link again.");
    setSentTo(result.email);
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="self-start">
          Change email
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{sentTo ? "Check your email" : "Change email"}</DialogTitle>
          <DialogDescription>
            {sentTo
              ? `We sent a confirmation link to ${sentTo}. Open it to finish. Until then you still sign in with ${currentEmail}.`
              : `You sign in with ${currentEmail}. We will email a confirmation link to your new address.`}
          </DialogDescription>
        </DialogHeader>
        {sentTo ? (
          <div className="flex flex-col gap-2 text-sm">
            {error ? (
              <p role="alert" className="text-destructive">
                {error}
              </p>
            ) : null}
            <p className="text-muted-foreground">
              No email? Check your spam folder or{" "}
              <button
                type="button"
                className="underline underline-offset-4 hover:text-foreground disabled:opacity-50"
                disabled={busy}
                onClick={() => send()}
              >
                send the link again
              </button>
              .
            </p>
          </div>
        ) : (
          <form id="change-email-form" onSubmit={send}>
            <Field data-invalid={!!error}>
              <FieldLabel htmlFor="change-email-new">New email</FieldLabel>
              <Input
                id="change-email-new"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-invalid={!!error}
                required
              />
              {error ? <FieldError errors={[{ message: error }]} /> : null}
            </Field>
          </form>
        )}
        <DialogFooter>
          {sentTo ? (
            <Button type="button" onClick={() => reset(false)}>
              Done
            </Button>
          ) : (
            <>
              <Button type="button" variant="ghost" onClick={() => reset(false)}>
                Cancel
              </Button>
              <Button type="submit" form="change-email-form" disabled={busy}>
                {busy ? "Sending..." : "Send link"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const PHOTO_MAX_BYTES = 2 * 1024 * 1024;

function ProfileHeader({ profile }: { readonly profile: OwnProfile }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<{ error: string } | { success: true }>, done: string) {
    setBusy(true);
    setError(null);
    const result = await action();
    setBusy(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    toast.success(done);
    router.refresh();
  }

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!PHOTO_TYPES.includes(file.type)) return setError("Use a JPG, PNG or WebP photo.");
    if (file.size > PHOTO_MAX_BYTES) return setError("The photo must be 2 MB or smaller.");
    const fd = new FormData();
    fd.set("avatar", file);
    await run(() => updateOwnAvatar(fd), "Photo updated.");
  }

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
        <Avatar className="size-24 text-2xl">
          {profile.avatar_url ? <AvatarImage src={profile.avatar_url} alt="" /> : null}
          <AvatarFallback className="text-2xl">{getInitials(profile.full_name || profile.email)}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-col items-center gap-2 sm:flex-row">
            <h2 className="truncate font-semibold text-xl">{profile.full_name || "Your profile"}</h2>
            {profile.role_label ? <Badge variant="secondary">{profile.role_label}</Badge> : null}
          </div>
          <p className="truncate text-muted-foreground text-sm">{profile.email}</p>
          <div className="mt-2 flex flex-wrap justify-center gap-2 sm:justify-start">
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
              {busy ? "Saving..." : profile.avatar_url ? "Change photo" : "Add photo"}
            </Button>
            {profile.avatar_url ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => run(removeOwnAvatar, "Photo removed.")}
              >
                Remove
              </Button>
            ) : null}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept={PHOTO_TYPES.join(",")}
            className="sr-only"
            tabIndex={-1}
            aria-label="Profile photo"
            onChange={onPick}
          />
          {error ? (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          ) : (
            <p className="text-muted-foreground text-xs">JPG, PNG or WebP, up to 2 MB.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
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
            {profile.can_change_email ? (
              <ChangeEmailDialog currentEmail={profile.email} />
            ) : (
              <FieldDescription>Contact GCE to change the email you sign in with.</FieldDescription>
            )}
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
        <CardDescription>
          Use 8 or more characters with upper and lower case letters, a number and a symbol.
        </CardDescription>
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
              aria-describedby="password-new-rules"
            />
            <PasswordRules id="password-new-rules" value={next} />
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
        <p className="text-muted-foreground text-sm">Your photo, details and password.</p>
      </div>
      <ProfileHeader profile={profile} />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <DetailsCard profile={profile} />
        <PasswordCard />
      </div>
    </div>
  );
}
