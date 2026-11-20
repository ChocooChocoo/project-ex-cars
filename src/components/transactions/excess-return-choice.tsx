"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

/**
 * Notes lines 163, 192, 209-213: the field worker states the trip's outcome before recording it. "Budget was exact"
 * sends 0 (system-confirmed, a read-only "No excess return" row for the Head Accountant); "Excess budget to return"
 * asks for the cash amount, which the Head Accountant then confirms.
 */
export function ExcessReturnChoice({
  idPrefix,
  excess,
  busy,
  onRecord,
}: {
  readonly idPrefix: string;
  /** The computed excess in pesos; it preselects the choice and fills the amount placeholder. */
  readonly excess: number;
  readonly busy: boolean;
  readonly onRecord: (returnedPesos: string) => void;
}) {
  const [choice, setChoice] = useState<"excess" | "exact">(excess > 0 ? "excess" : "exact");
  const [amount, setAmount] = useState("");
  const value = amount === "" ? String(excess) : amount;
  const invalid = choice === "excess" && !(Number(value) > 0);

  return (
    <div className="flex flex-col gap-3 border-t pt-3">
      <RadioGroup
        value={choice}
        onValueChange={(next) => setChoice(next as "excess" | "exact")}
        aria-label="Trip budget outcome"
      >
        <div className="flex items-center gap-2">
          <RadioGroupItem id={`${idPrefix}-excess`} value="excess" />
          <Label htmlFor={`${idPrefix}-excess`}>Excess budget to return</Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem id={`${idPrefix}-exact`} value="exact" />
          <Label htmlFor={`${idPrefix}-exact`}>Budget was exact for the trip</Label>
        </div>
      </RadioGroup>
      {choice === "excess" ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-amount`}>Cash returned (₱)</Label>
          <Input
            id={`${idPrefix}-amount`}
            type="number"
            min="1"
            className="max-w-48"
            placeholder={String(excess)}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
      ) : null}
      <Button
        size="sm"
        className="self-start"
        disabled={busy || invalid}
        onClick={() => onRecord(choice === "exact" ? "0" : value)}
      >
        Record Excess Return
      </Button>
    </div>
  );
}
