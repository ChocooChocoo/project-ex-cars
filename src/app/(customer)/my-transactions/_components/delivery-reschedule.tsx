"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { format } from "date-fns";
import { toast } from "sonner";

import { AddressFields } from "@/components/profile/address-fields";
import { SlotPicker } from "@/components/transactions/slot-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ProfileAutoFill } from "@/lib/autofill";
import { type AddressValue, emptyAddressValue } from "@/lib/psgc/address";
import { RESCHEDULE_FREE_HOURS, rescheduleFee } from "@/lib/transactions/buy-flow";
import { formatCurrency } from "@/lib/utils";

import { requestDeliveryReschedule } from "../actions";

// T10: the buyer moves their own delivery. Free until 24 hours before the original delivery time; after that
// a warning asks them to accept a fee of half the delivery fee, paid through PayMongo.
export function DeliveryReschedule({
  transactionId,
  originalSchedule,
  deliveryFee,
  pendingAt,
  autofill,
}: {
  readonly transactionId: string;
  readonly originalSchedule: string;
  readonly deliveryFee: number;
  readonly pendingAt: string | null;
  readonly autofill: ProfileAutoFill | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState<"closed" | "warning" | "form">("closed");
  const [acknowledged, setAcknowledged] = useState(false);
  const [schedule, setSchedule] = useState("");
  const [busy, setBusy] = useState(false);
  const [address, setAddress] = useState<AddressValue>(() => ({
    ...emptyAddressValue(),
    address_line: autofill?.address_line ?? "",
    region_code: autofill?.region_code ?? "",
    province_code: autofill?.province_code ?? "",
    city_code: autofill?.city_code ?? "",
    barangay_code: autofill?.barangay_code ?? "",
  }));
  const fee = rescheduleFee(new Date(originalSchedule), deliveryFee);

  function open() {
    setAcknowledged(false);
    setSchedule("");
    setStep(fee > 0 ? "warning" : "form");
  }

  async function submit() {
    const fd = new FormData();
    fd.set("transaction_id", transactionId);
    fd.set("schedule", schedule);
    if (acknowledged) fd.set("acknowledge_fee", "yes");
    for (const [key, value] of Object.entries(address)) fd.set(key, value);
    setBusy(true);
    const result = await requestDeliveryReschedule(fd);
    setBusy(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    if (result.url) {
      window.location.assign(result.url);
      return;
    }
    toast.success("Delivery re-scheduled. The team has the new schedule.");
    setStep("closed");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <p className="font-medium text-sm">Need another time or place?</p>
      {pendingAt ? (
        <p className="text-muted-foreground text-sm">
          Your new delivery time ({format(new Date(pendingAt), "MMM d, h:mm a")}) is waiting for the Head Accountant to
          verify the re-scheduling fee.
        </p>
      ) : (
        <>
          <p className="text-muted-foreground text-sm">
            You can re-schedule this delivery yourself. It is free until {RESCHEDULE_FREE_HOURS} hours before{" "}
            {format(new Date(originalSchedule), "MMM d, h:mm a")}; after that a fee of half the delivery fee applies.
          </p>
          <Button size="sm" variant="outline" className="min-h-11 self-start" onClick={open}>
            Re-schedule delivery
          </Button>
        </>
      )}

      <Dialog open={step === "warning"} onOpenChange={(value) => !value && setStep("closed")}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>A re-scheduling fee applies</DialogTitle>
            <DialogDescription>
              Your delivery is less than {RESCHEDULE_FREE_HOURS} hours away. Re-scheduling now costs{" "}
              {formatCurrency(fee)}, half the delivery fee, paid through PayMongo. The team gets the new schedule once
              the Head Accountant verifies the payment.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStep("closed")}>
              Keep my schedule
            </Button>
            <Button
              onClick={() => {
                setAcknowledged(true);
                setStep("form");
              }}
            >
              I understand, continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={step === "form"} onOpenChange={(value) => !value && !busy && setStep("closed")}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Re-schedule delivery</DialogTitle>
            <DialogDescription>
              Set the new date, time and exact delivery address.
              {fee > 0 ? ` You pay ${formatCurrency(fee)} on PayMongo next.` : " Re-scheduling is free."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <SlotPicker
              id="reschedule-slot"
              label="New date and time"
              value={schedule}
              onChange={(value) => setSchedule(value)}
            />
            <AddressFields value={address} onChange={setAddress} storedAddress={autofill?.address ?? undefined} />
          </div>
          <DialogFooter>
            <Button className="min-h-11" disabled={busy || !schedule || !address.barangay_code} onClick={submit}>
              {busy ? "Saving…" : fee > 0 ? "Continue to PayMongo" : "Save new schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
