"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { toast } from "sonner";

import { advanceRecovery, updateRecoveryLocation, uploadTowEvidence } from "@/app/(staff)/field-cases/recovery-actions";
import { LiveLocationMap } from "@/components/live-location-map";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { ShareLocation } from "./share-location";

type Recovery = {
  id: string;
  state: string;
  notes: string | null;
  last_located_at: string | null;
  last_lat: number | null;
  last_lng: number | null;
};
type Transaction = {
  profiles: { full_name: string | null }[] | { full_name: string | null } | null;
  vehicles: { make: string; model: string; year: number }[] | { make: string; model: string; year: number } | null;
};
type Worker = { account_id: string; full_name: string | null };
export function RecoveryCase({
  fieldCase,
  transaction,
  mechanics,
  canAct,
  isInformant,
  evidence,
}: {
  readonly fieldCase: Recovery;
  readonly transaction: Transaction;
  readonly mechanics: Worker[];
  readonly canAct: boolean;
  readonly isInformant: boolean;
  readonly evidence: { id: string; url: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const buyer = Array.isArray(transaction.profiles) ? transaction.profiles[0] : transaction.profiles;
  const vehicle = Array.isArray(transaction.vehicles) ? transaction.vehicles[0] : transaction.vehicles;
  const open = !["completed", "cancelled"].includes(fieldCase.state);
  const next =
    fieldCase.state === "assigned" ? "accepted" : fieldCase.state === "accepted" ? "in_progress" : "completed";
  async function send(action: typeof advanceRecovery, fd: FormData) {
    fd.set("field_case_id", fieldCase.id);
    setBusy(true);
    try {
      const result = await action(fd);
      if ("error" in result) toast.error(result.error);
      else {
        router.refresh();
        toast.success("Recovery case updated.");
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-4">
      <h1 className="text-3xl">Vehicle recovery</h1>
      <section className="space-y-2 rounded-md border p-4">
        <h2 className="font-semibold">Towing instructions</h2>
        <p>Buyer: {buyer?.full_name ?? "Not recorded"}</p>
        <p>
          Vehicle: {vehicle?.make} {vehicle?.model} {vehicle?.year}
        </p>
        <p>Status: {fieldCase.state}</p>
        <p className="whitespace-pre-line">{fieldCase.notes}</p>
        <LiveLocationMap
          fieldCaseId={fieldCase.id}
          initial={{
            lat: fieldCase.last_lat,
            lng: fieldCase.last_lng,
            at: fieldCase.last_located_at,
          }}
        />
      </section>
      {canAct && open ? (
        <section className="space-y-4 rounded-md border p-4">
          <form action={(fd) => send(advanceRecovery, fd)} className="space-y-3">
            <input type="hidden" name="state" value={next} />
            <Label htmlFor="tow-notes">Tow notes</Label>
            <Textarea id="tow-notes" name="notes" maxLength={4000} />
            {next === "completed" && isInformant ? (
              <>
                <Label htmlFor="recovery-mechanic">Handover mechanic</Label>
                <select
                  required
                  id="recovery-mechanic"
                  name="mechanic_id"
                  className="min-h-11 w-full rounded-md border bg-background px-3"
                >
                  <option value="">Choose active mechanic</option>
                  {mechanics.map((worker) => (
                    <option key={worker.account_id} value={worker.account_id}>
                      {worker.full_name ?? worker.account_id}
                    </option>
                  ))}
                </select>
              </>
            ) : null}
            {next !== "completed" || isInformant ? (
              <Button disabled={busy} type="submit">
                {next === "accepted" ? "Accept" : next === "in_progress" ? "Start" : "Mark recovered and hand over"}
              </Button>
            ) : (
              <p>Waiting for the Confidential Informant to hand over the vehicle.</p>
            )}
          </form>
          <form action={(fd) => send(uploadTowEvidence, fd)} className="space-y-2">
            <Label htmlFor="tow-evidence">Tow evidence photo</Label>
            <Input id="tow-evidence" name="file" type="file" required accept="image/jpeg,image/png,image/webp" />
            <Button variant="outline" disabled={busy} type="submit">
              Upload tow evidence
            </Button>
          </form>
          {fieldCase.state === "in_progress" ? (
            <ShareLocation fieldCaseId={fieldCase.id} updateLocation={updateRecoveryLocation} />
          ) : null}
        </section>
      ) : null}
      <section className="space-y-2">
        <h2 className="font-semibold">Tow evidence</h2>
        {evidence.length ? (
          evidence.map((photo) => (
            <a key={photo.id} href={photo.url} className="mr-4 underline" target="_blank" rel="noreferrer">
              View photo
            </a>
          ))
        ) : (
          <p>No tow evidence uploaded.</p>
        )}
      </section>
    </div>
  );
}
