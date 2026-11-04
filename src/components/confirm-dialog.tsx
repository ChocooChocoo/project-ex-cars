"use client";

import { type ReactElement, useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type ConfirmDialogProps = {
  /** The button that opens the dialog. Leave it out and pass `open`/`onOpenChange` to open it from a menu. */
  readonly trigger?: ReactElement;
  readonly open?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
  /** "approve" and "reject" fill in the reviewers' standard wording; override with title/description. */
  readonly action: "approve" | "reject";
  readonly title?: string;
  readonly description?: string;
  readonly confirmLabel?: string;
  readonly onConfirm: () => Promise<unknown> | unknown;
};

// T06: every approval and rejection asks "Are you sure?" before it runs.
export function ConfirmDialog({
  trigger,
  open: controlledOpen,
  onOpenChange,
  action,
  title,
  description,
  confirmLabel,
  onConfirm,
}: ConfirmDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) setOpen(next);
      }}
    >
      {trigger ? <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger> : null}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title ?? `Are you sure you want to ${action} this?`}</AlertDialogTitle>
          <AlertDialogDescription>{description ?? "This action cannot be undone."}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant={action === "reject" ? "destructive" : "default"}
            disabled={busy}
            onClick={(event) => {
              event.preventDefault();
              void confirm();
            }}
          >
            {busy ? "Saving..." : (confirmLabel ?? (action === "approve" ? "Approve" : "Reject"))}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
