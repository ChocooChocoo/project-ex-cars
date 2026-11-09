"use client";

import { useId, useState } from "react";

import { CheckCircle2, Circle, Clock, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { documentSlots, type SlotDocument } from "@/lib/transactions/document-slots";

export const VALID_ID_TYPES = [
  { value: "passport", label: "Passport" },
  { value: "drivers_license", label: "Driver's License" },
  { value: "umid", label: "UMID" },
  { value: "sss_id", label: "SSS ID" },
  { value: "gsis_id", label: "GSIS ID" },
  { value: "philhealth_id", label: "PhilHealth ID" },
  { value: "voters_id", label: "Voter's ID" },
  { value: "national_id", label: "National ID" },
  { value: "prc_id", label: "PRC ID" },
  { value: "postal_id", label: "Postal ID" },
] as const;

export type DocumentUpload = {
  kind: "valid_id" | "proof_of_billing";
  idType?: string;
  side?: "front" | "back";
  file: File;
};

const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";

function Status({ doc }: { readonly doc: SlotDocument | null }) {
  const state = doc?.verification_state;
  if (!doc) {
    return (
      <Badge variant="outline" className="gap-1">
        <Circle className="size-3" aria-hidden="true" /> Missing
      </Badge>
    );
  }
  if (state === "verified") {
    return (
      <Badge className="gap-1">
        <CheckCircle2 className="size-3" aria-hidden="true" /> Verified
      </Badge>
    );
  }
  if (state === "rejected") {
    return (
      <Badge variant="destructive" className="gap-1">
        <XCircle className="size-3" aria-hidden="true" /> Rejected
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1">
      <Clock className="size-3" aria-hidden="true" /> Uploaded, being checked
    </Badge>
  );
}

function UploadRow({
  label,
  doc,
  disabled,
  onFile,
}: {
  readonly label: string;
  readonly doc: SlotDocument | null;
  readonly disabled: boolean;
  readonly onFile: (file: File) => void;
}) {
  const id = useId();
  const needsFile = !doc || doc.verification_state === "rejected";
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor={id} className="text-sm">
          {label}
        </Label>
        <Status doc={doc} />
      </div>
      {doc?.verification_state === "rejected" ? (
        <p className="text-destructive text-xs">
          Upload a new one.{doc.rejection_reason ? ` What to fix: ${String(doc.rejection_reason)}` : ""}
        </p>
      ) : null}
      {needsFile ? (
        <Input
          id={id}
          type="file"
          accept={ACCEPT}
          disabled={disabled}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onFile(file);
            event.target.value = "";
          }}
        />
      ) : null}
    </div>
  );
}

// T06: first-time buyers found the old single upload box confusing. The section now lists exactly what GCE
// needs, two valid IDs (front and back) and one proof of billing, with the status of each.
export function PurchaseDocumentChecklist({
  documents,
  canUpload,
  uploading,
  onUpload,
}: {
  readonly documents: SlotDocument[];
  readonly canUpload: boolean;
  readonly uploading: boolean;
  readonly onUpload: (upload: DocumentUpload) => void;
}) {
  const slots = documentSlots(documents);
  const [chosenTypes, setChosenTypes] = useState<[string, string]>(["", ""]);
  const disabled = !canUpload || uploading;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-sm">
        To buy a car, send GCE <span className="font-medium text-foreground">2 different valid IDs</span> (a photo of
        the front and the back of each) and <span className="font-medium text-foreground">1 proof of billing</span> (a
        recent utility, internet or phone bill in your name). JPEG, PNG, WebP or PDF, up to 2 MB each. GCE staff check
        every file.
      </p>
      <ol className="grid gap-3 md:grid-cols-3">
        {slots.ids.map((slot, index) => {
          const idType = slot.idType ?? chosenTypes[index];
          const otherType = slots.ids[1 - index].idType ?? chosenTypes[1 - index];
          const typeId = `id-type-${index}`;
          const upload = (side: "front" | "back") => (file: File) => onUpload({ kind: "valid_id", idType, side, file });
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: the two ID slots are fixed positions.
            <li key={index} className="flex flex-col gap-3 rounded-lg border p-3">
              <p className="font-medium text-sm">Valid ID #{index + 1}</p>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={typeId} className="text-xs">
                  ID type
                </Label>
                <Select
                  value={idType || undefined}
                  disabled={disabled || slot.idType !== null}
                  onValueChange={(value) =>
                    setChosenTypes((current) => {
                      const next: [string, string] = [...current];
                      next[index] = value;
                      return next;
                    })
                  }
                >
                  <SelectTrigger id={typeId} className="w-full">
                    <SelectValue placeholder="Select the ID" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {VALID_ID_TYPES.filter((type) => type.value !== otherType).map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <UploadRow label="Front" doc={slot.front} disabled={disabled || !idType} onFile={upload("front")} />
              <UploadRow label="Back" doc={slot.back} disabled={disabled || !idType} onFile={upload("back")} />
              {!idType && canUpload ? <p className="text-muted-foreground text-xs">Choose the ID type first.</p> : null}
            </li>
          );
        })}
        <li className="flex flex-col gap-3 rounded-lg border p-3">
          <p className="font-medium text-sm">Proof of billing</p>
          <UploadRow
            label="Bill"
            doc={slots.billing}
            disabled={disabled}
            onFile={(file) => onUpload({ kind: "proof_of_billing", file })}
          />
        </li>
      </ol>
      {uploading ? <p className="text-muted-foreground text-xs">Uploading...</p> : null}
    </div>
  );
}
