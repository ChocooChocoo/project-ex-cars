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
} from "@/components/ui/dialog";

import { completeTutorial } from "./actions";
import { tutorialSteps } from "./tutorial-steps";

// T06: shown once to a new account. Every step can be advanced (Next) or skipped (Skip); both Skip and the
// last step's Finish record the tutorial as done, so it does not come back.
export function OnboardingTour({ userRole }: { readonly userRole: string | null }) {
  const steps = tutorialSteps(userRole);
  const [open, setOpen] = useState(true);
  const [index, setIndex] = useState(0);
  const step = steps[index];
  const last = index === steps.length - 1;

  function finish() {
    setOpen(false);
    void completeTutorial();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) finish();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <p className="text-muted-foreground text-xs" aria-live="polite">
            Step {index + 1} of {steps.length}
          </p>
          <DialogTitle>{step.title}</DialogTitle>
          <DialogDescription>{step.body}</DialogDescription>
        </DialogHeader>
        <div className="flex gap-1" aria-hidden="true">
          {steps.map((s, i) => (
            <span key={s.title} className={`h-1 flex-1 rounded-full ${i <= index ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>
        <DialogFooter className="sm:justify-between">
          <Button variant="ghost" onClick={finish}>
            Skip
          </Button>
          <div className="flex gap-2">
            {index > 0 ? (
              <Button variant="outline" onClick={() => setIndex(index - 1)}>
                Back
              </Button>
            ) : null}
            <Button onClick={() => (last ? finish() : setIndex(index + 1))}>{last ? "Finish" : "Next"}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
