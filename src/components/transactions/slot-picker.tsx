"use client";

import { useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { isSundayInManila, manilaDay, SLOT_HOURS, slotFromParts, slotHours } from "@/lib/transactions/buy-flow";
import { cn } from "@/lib/utils";

const CLOSED_MESSAGE = "GCE is closed on Sundays.";
const RULE_MESSAGE = "Pick a time on the hour, 9 AM to 9 PM, Monday to Saturday.";

export type SlotDraft = { date: string; hour: number | null };

// A stored slot comes back as an instant: show it on the Manila day and hour it was booked for.
function splitSlot(value: string): SlotDraft {
  const at = new Date(value);
  if (!value || Number.isNaN(at.getTime())) return { date: "", hour: null };
  const manila = new Date(at.getTime() + 8 * 60 * 60 * 1000);
  const hour = manila.getUTCHours();
  return {
    date: manila.toISOString().slice(0, 10),
    hour: (SLOT_HOURS as readonly number[]).includes(hour) ? hour : null,
  };
}

function hourLabel(hour: number): string {
  return `${hour % 12 || 12}:00 ${hour < 12 ? "AM" : "PM"}`;
}

// The two fields behind every GCE appointment: a Manila date, then a whole hour on it. It hands the
// parent an ISO string in Manila time, or "" until an hour is picked, so the browser's own time zone
// never moves the booking.
export function SlotPicker({
  id,
  label,
  value,
  onChange,
  minDays = 0,
  takenSlots = [],
  disabled = false,
  className,
}: {
  readonly id: string;
  readonly label: string;
  /** The booked slot as an ISO instant, or "" until the buyer has picked an hour. */
  readonly value: string;
  /** Gives the ISO slot, or "", plus the date and hour so a date without an hour can block saving. */
  readonly onChange: (value: string, draft: SlotDraft) => void;
  /** Earliest day that can be booked, counted from today in Manila. Delivery needs 7. */
  readonly minDays?: number;
  readonly takenSlots?: string[];
  readonly disabled?: boolean;
  readonly className?: string;
}) {
  const [draft, setDraft] = useState<SlotDraft>(() => splitSlot(value));
  const emitted = useRef<string | null>(null);
  // Follow a value the parent changed itself (a reset form), not the echo of what the picker just sent:
  // changing the date sends "", which must not blank the date field.
  useEffect(() => {
    if (value === emitted.current) {
      emitted.current = null;
      return;
    }
    setDraft(splitSlot(value));
  }, [value]);

  const now = new Date();
  const min = manilaDay(now, minDays);
  const closed = isSundayInManila(draft.date);
  const hours = slotHours(draft.date, now, takenSlots);
  const soldOut = draft.date !== "" && !closed && hours.length === 0;

  function emit(next: string, nextDraft: SlotDraft) {
    emitted.current = next;
    setDraft(nextDraft);
    onChange(next, nextDraft);
  }

  function pickDate(next: string) {
    emit("", { date: next, hour: null });
  }

  function pickHour(next: string) {
    const hour = Number(next);
    emit(slotFromParts(draft.date, hour), { date: draft.date, hour });
  }

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={`${id}-date`}>{label}</Label>
      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          id={`${id}-date`}
          type="date"
          min={min}
          value={draft.date}
          onChange={(event) => pickDate(event.target.value)}
          disabled={disabled}
          aria-describedby={`${id}-rule`}
        />
        {closed ? null : (
          <Select
            value={draft.hour === null ? "" : String(draft.hour)}
            onValueChange={pickHour}
            disabled={draft.date.length === 0 || hours.length === 0 || disabled}
          >
            <SelectTrigger id={`${id}-hour`} aria-label="Hour" aria-describedby={`${id}-rule`}>
              <SelectValue
                placeholder={!draft.date ? "Pick a date first" : soldOut ? "No slots left" : "Select hour"}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {hours.map((hour) => (
                  <SelectItem key={hour} value={String(hour)}>
                    {hourLabel(hour)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        )}
      </div>
      <p id={`${id}-rule`} className="text-muted-foreground text-xs" aria-live="polite">
        {closed ? CLOSED_MESSAGE : RULE_MESSAGE}
        {minDays > 0 && !closed ? ` Delivery needs at least ${minDays} days from today.` : ""}
      </p>
      {soldOut ? (
        <p className="text-muted-foreground text-xs" aria-live="polite">
          No slots are left on that day. Pick another day.
        </p>
      ) : null}
    </div>
  );
}
