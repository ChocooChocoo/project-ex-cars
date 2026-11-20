"use client";

import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { composeMeetupAddress, emptyMeetupAddress, type MeetupAddressParts } from "@/lib/transactions/meetup-area";

const ROWS = [
  ["region", "Region"],
  ["province", "Province"],
  ["city", "City / Municipality"],
  ["barangay", "Barangay"],
] as const;

/**
 * BH-8: Region, Province, City-Municipality and Barangay come from the reverse geocoder and are read-only. Block,
 * lot and street cannot be geocoded, so they stay typed. No Leaflet here: this block is safe to render anywhere.
 */
export function MeetupAddressFields({
  value,
  onChange,
  editable = true,
  error = null,
}: {
  readonly value: MeetupAddressParts | null;
  readonly onChange?: (next: MeetupAddressParts) => void;
  readonly editable?: boolean;
  readonly error?: string | null;
}) {
  const address = value ?? emptyMeetupAddress();
  const composed = composeMeetupAddress(address);

  return (
    <div className="flex flex-col gap-3">
      <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2" aria-label="Meet-up address">
        {ROWS.map(([key, label]) => (
          <div key={key} className="flex justify-between gap-2 border-b pb-1">
            <dt className="text-muted-foreground text-xs">{label}</dt>
            <dd className="text-right">{address[key] || "—"}</dd>
          </div>
        ))}
      </dl>
      {editable ? (
        <Field data-invalid={!!error}>
          <FieldLabel htmlFor="meetup-address-line">Block, lot, street / landmark</FieldLabel>
          <Input
            id="meetup-address-line"
            value={address.block_lot}
            maxLength={200}
            placeholder="Block 4 Lot 5, beside the covered court"
            onChange={(event) => onChange?.({ ...address, block_lot: event.target.value })}
          />
          <FieldDescription>
            The map cannot read a block and lot, so type exactly where the meet-up is.
            {composed ? ` Saved as: ${composed}.` : ""}
          </FieldDescription>
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
        </Field>
      ) : (
        <p className="text-muted-foreground text-sm">{composed || "No address recorded for this meet-up yet."}</p>
      )}
    </div>
  );
}
