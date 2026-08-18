"use client";
"use no memo";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { Archive, Megaphone, Plus, Send, TimerOff } from "lucide-react";
import { toast } from "sonner";

import {
  archiveAnnouncement,
  createAnnouncement,
  expireAnnouncement,
  publishAnnouncement,
} from "@/app/(staff)/announcements/actions";
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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export interface AnnouncementRow {
  id: string;
  title: string;
  body: string;
  status: "draft" | "published" | "expired" | "archived";
  published_at: string | null;
  expires_at: string | null;
  created_at: string;
}

interface AnnouncementsClientProps {
  announcements: AnnouncementRow[];
  canManage: boolean;
}

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline",
  published: "default",
  expired: "secondary",
  archived: "destructive",
};

type StatusAction = "publish" | "expire";

export function AnnouncementsClient({ announcements, canManage }: AnnouncementsClientProps) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusTarget, setStatusTarget] = useState<{ announcement: AnnouncementRow; action: StatusAction } | null>(
    null,
  );
  const [statusLoading, setStatusLoading] = useState(false);

  async function submitForm() {
    setLoading(true);
    setFormError(null);
    const fd = new FormData();
    fd.set("title", title);
    fd.set("body", body);
    fd.set("expires_at", expiresAt);
    const result = await createAnnouncement(fd);
    setLoading(false);
    if ("error" in result && result.error) {
      setFormError(result.error);
      return;
    }
    toast.success("Announcement draft created.");
    setFormOpen(false);
    setTitle("");
    setBody("");
    setExpiresAt("");
    router.refresh();
  }

  async function runStatusAction(
    action: (fd: FormData) => Promise<{ error?: string } | { success?: boolean }>,
    id: string,
    successMessage: string,
  ): Promise<boolean> {
    const fd = new FormData();
    fd.set("announcement_id", id);
    const result = await action(fd);
    if ("error" in result && result.error) {
      toast.error(result.error);
      return false;
    }
    toast.success(successMessage);
    router.refresh();
    return true;
  }

  async function confirmStatusAction() {
    if (!statusTarget || statusLoading) return;
    setStatusLoading(true);
    const { announcement, action } = statusTarget;
    const confirmed =
      action === "publish"
        ? await runStatusAction(publishAnnouncement, announcement.id, "Announcement published.")
        : await runStatusAction(expireAnnouncement, announcement.id, "Announcement expired.");
    setStatusLoading(false);
    if (confirmed) setStatusTarget(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-3xl tracking-tight">Announcements</h1>
          <p className="text-muted-foreground text-sm">
            {canManage ? "Draft, publish, and retire company announcements." : "Active company announcements."}
          </p>
        </div>
        {canManage ? (
          <Button onClick={() => setFormOpen(true)}>
            <Plus data-icon="inline-start" />
            New Announcement
          </Button>
        ) : null}
      </div>

      {announcements.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <Megaphone className="size-8 text-muted-foreground" />
            <p className="text-muted-foreground">No announcements.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {announcements.map((announcement) => (
            <Card key={announcement.id}>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">{announcement.title}</CardTitle>
                  <Badge variant={STATUS_VARIANTS[announcement.status]}>{announcement.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <p className="text-muted-foreground text-sm">{announcement.body}</p>
                <div className="flex flex-wrap items-center gap-3 text-muted-foreground text-xs">
                  {announcement.published_at ? (
                    <span>Published {new Date(announcement.published_at).toLocaleDateString()}</span>
                  ) : (
                    <span>Created {new Date(announcement.created_at).toLocaleDateString()}</span>
                  )}
                  {announcement.expires_at ? (
                    <span>Expires {new Date(announcement.expires_at).toLocaleDateString()}</span>
                  ) : null}
                </div>
                {canManage && announcement.status === "draft" ? (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => setStatusTarget({ announcement, action: "publish" })}>
                      <Send data-icon="inline-start" />
                      Publish
                    </Button>
                  </div>
                ) : null}
                {canManage && announcement.status === "published" ? (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setStatusTarget({ announcement, action: "expire" })}
                    >
                      <TimerOff data-icon="inline-start" />
                      Expire
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => runStatusAction(archiveAnnouncement, announcement.id, "Announcement archived.")}
                    >
                      <Archive data-icon="inline-start" />
                      Archive
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Announcement</DialogTitle>
          </DialogHeader>
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel>Title</FieldLabel>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Company-wide notice" />
            </Field>
            <Field>
              <FieldLabel>Body</FieldLabel>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                placeholder="Write the announcement..."
              />
            </Field>
            <Field>
              <FieldLabel>Expires At (optional)</FieldLabel>
              <Input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            </Field>
            {formError ? <p className="text-destructive text-sm">{formError}</p> : null}
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={submitForm} disabled={loading}>
              {loading ? "Saving..." : "Save Draft"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!statusTarget}
        onOpenChange={(open) => {
          if (!open && !statusLoading) setStatusTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {statusTarget?.action === "publish" ? "Publish announcement?" : "Expire announcement?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {statusTarget?.action === "publish"
                ? `“${statusTarget.announcement.title}” will become visible to its intended audience.`
                : `“${statusTarget?.announcement.title}” will no longer be active.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={statusLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmStatusAction} disabled={statusLoading}>
              {statusLoading ? "Saving..." : statusTarget?.action === "publish" ? "Publish" : "Expire"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
