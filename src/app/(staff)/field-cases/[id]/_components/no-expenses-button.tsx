"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { toast } from "sonner";

import { updateFieldCase } from "@/app/(staff)/field-cases/actions";
import { Button } from "@/components/ui/button";

/**
 * SN-8: a Meet Halfway seller meet-up closes only once the travel expenses are filed. A trip that honestly cost
 * nothing gets this explicit confirmation instead, which records `field_cases.no_expenses_at` and satisfies the
 * guard without inventing a zero-value expense row.
 */
export function NoExpensesButton({
  fieldCaseId,
  className,
}: {
  readonly fieldCaseId: string;
  readonly className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function confirm() {
    const fd = new FormData();
    fd.set("field_case_id", fieldCaseId);
    fd.set("no_expenses", "1");
    setBusy(true);
    const result = await updateFieldCase(fd);
    setBusy(false);
    if ("error" in result && result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("No expenses recorded for this trip.");
    router.refresh();
  }

  return (
    <Button size="sm" variant="outline" className={className ?? "self-start"} disabled={busy} onClick={confirm}>
      No expenses for this trip
    </Button>
  );
}
