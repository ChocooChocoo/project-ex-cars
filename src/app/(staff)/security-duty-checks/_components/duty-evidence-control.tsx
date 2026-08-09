"use client";

import { useRef } from "react";

import { Upload } from "lucide-react";

import { Button } from "@/components/ui/button";

export type DutyEvidenceSlot = "before" | "after";
export type DutyEvidenceUpload = (checkId: string, slot: DutyEvidenceSlot, file: File) => Promise<void>;

interface DutyEvidenceControlProps {
  checkId: string;
  dutyDate: string;
  slot: DutyEvidenceSlot;
  path: string | null;
  canManage: boolean;
  disabled: boolean;
  uploading: boolean;
  onUpload: DutyEvidenceUpload;
}

export function DutyEvidenceControl({
  checkId,
  dutyDate,
  slot,
  path,
  canManage,
  disabled,
  uploading,
  onUpload,
}: DutyEvidenceControlProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const slotLabel = slot === "before" ? "Before" : "After";
  const uploadLabel = `Upload ${slot} evidence for duty check ${dutyDate} (${checkId})`;
  const chooseLabel = `Choose ${slot} evidence for duty check ${dutyDate} (${checkId})`;
  const inputId = `duty-check-${checkId}-${slot}-evidence`;

  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-lg border p-3" data-testid={`duty-evidence-${checkId}-${slot}`}>
      <span className="text-muted-foreground text-xs">{slotLabel}</span>
      <p className="font-medium">{path ? "Uploaded" : "Pending"}</p>
      {canManage && !disabled ? (
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2 w-full"
            disabled={uploading}
            aria-label={chooseLabel}
            onClick={() => inputRef.current?.click()}
          >
            <Upload data-icon="inline-start" />
            {uploading ? "Uploading..." : "Upload"}
          </Button>
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            aria-label={uploadLabel}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) void onUpload(checkId, slot, file);
              event.currentTarget.value = "";
            }}
          />
        </>
      ) : null}
    </div>
  );
}
