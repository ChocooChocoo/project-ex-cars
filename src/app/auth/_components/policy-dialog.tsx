"use client";

import { useState } from "react";

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
import type { LegalDocument } from "@/lib/legal/documents";

// T06: the reader scrolls to the end before "I have read this" unlocks. A short document that fits without
// scrolling counts as read straight away.
export function PolicyDialog({
  document,
  read,
  onRead,
}: {
  readonly document: LegalDocument;
  readonly read: boolean;
  readonly onRead: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [reachedEnd, setReachedEnd] = useState(false);

  function checkEnd(element: HTMLElement | null) {
    if (element && element.scrollTop + element.clientHeight >= element.scrollHeight - 8) setReachedEnd(true);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="link" className="h-auto p-0 font-normal">
          {read ? `Read again: ${document.title}` : `Read the ${document.title}`}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{document.title}</DialogTitle>
          <DialogDescription>Scroll to the end to continue.</DialogDescription>
        </DialogHeader>
        <div
          ref={checkEnd}
          onScroll={(event) => checkEnd(event.currentTarget)}
          className="flex max-h-[55vh] flex-col gap-4 overflow-y-auto pr-2 text-sm"
          // biome-ignore lint/a11y/noNoninteractiveTabindex: keyboard users scroll the document with the arrow keys.
          tabIndex={0}
        >
          {document.sections.map((section) => (
            <section key={section.heading} className="flex flex-col gap-1">
              <h3 className="font-medium">{section.heading}</h3>
              <p className="text-muted-foreground">{section.body}</p>
            </section>
          ))}
        </div>
        <DialogFooter>
          <Button
            type="button"
            disabled={!reachedEnd && !read}
            onClick={() => {
              onRead();
              setOpen(false);
            }}
          >
            I have read this
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
