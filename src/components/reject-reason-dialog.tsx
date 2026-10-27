"use client";

import { type ReactElement, useId, useState } from "react";

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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type RejectReasonDialogProps = {
  readonly trigger: ReactElement;
  readonly title: string;
  readonly description: string;
  readonly label?: string;
} & (
  | {
      readonly placeholder?: string;
      readonly confirmLabel: string;
      readonly onConfirm: (reason: string) => Promise<void> | void;
      readonly reason?: undefined;
    }
  | {
      /** T03 C14: read mode. Shows a stored reason with a Close button only. */
      readonly reason: string;
      readonly placeholder?: undefined;
      readonly confirmLabel?: undefined;
      readonly onConfirm?: undefined;
    }
);

// T03 HA3: rejecting anything (a payment, a document) asks for the reason in a modal; the confirm button stays
// disabled until a reason is typed. With `reason` set, the same modal shows the stored reason (C14).
export function RejectReasonDialog({
  trigger,
  title,
  description,
  label = "Reason",
  placeholder,
  confirmLabel,
  onConfirm,
  reason: storedReason,
}: RejectReasonDialogProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function confirm() {
    if (!onConfirm) return;
    setBusy(true);
    await onConfirm(reason.trim());
    setBusy(false);
    setOpen(false);
    setReason("");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) setOpen(next);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {storedReason !== undefined ? (
          <>
            <div className="flex flex-col gap-1.5">
              <p className="font-medium text-sm">{label}</p>
              <p className="whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-sm">{storedReason}</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={id}>{label}</Label>
              <Textarea
                id={id}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={3}
                maxLength={1000}
                placeholder={placeholder}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" disabled={busy || reason.trim().length === 0} onClick={confirm}>
                {busy ? "Saving..." : confirmLabel}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
