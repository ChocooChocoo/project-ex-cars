"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { toast } from "sonner";

import { receiveFieldCase } from "@/app/(staff)/field-cases/delivery-actions";
import { Button } from "@/components/ui/button";

// The assigned Confidential Informant and Mechanic each acknowledge the meet-up they were sent.
export function ReceiveCaseButton({ fieldCaseId }: { readonly fieldCaseId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function receive() {
    const fd = new FormData();
    fd.set("field_case_id", fieldCaseId);
    setBusy(true);
    const result = await receiveFieldCase(fd);
    setBusy(false);
    if ("error" in result) toast.error(result.error);
    else {
      toast.success("Field case received.");
      router.refresh();
    }
  }

  return (
    <Button size="sm" className="self-start" disabled={busy} onClick={receive}>
      Receive Field Case
    </Button>
  );
}
