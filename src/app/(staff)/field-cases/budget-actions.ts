"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { getCurrentRole } from "@/app/auth/actions";
import { notify } from "@/lib/notifications/notify";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { budgetReleased } from "@/lib/transactions/field-budget";
import { formatCurrency } from "@/lib/utils";

type BudgetResult = { error: string } | { success: true };

const CASE_LABELS: Record<string, string> = {
  delivery: "Delivery",
  buyer_meetup: "Buyer meet-up",
  acquisition: "Meet Halfway purchase",
};

// T10: the Confidential Informant assigned to the case requests and returns its budget. For a returned excess,
// whoever requested the funds may also record it (the Marketing Specialist on a GCE Visit purchase).
async function assignedInformant(fieldCaseId: unknown, requesterMayAct = false) {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: "Not authenticated" } as const;
  const role = await getCurrentRole();
  const id = z.string().uuid().safeParse(fieldCaseId);
  if (!id.success) return { error: "Invalid field case." } as const;
  const admin = createAdminClient();
  const { data: fieldCase } = await admin
    .from("field_cases")
    .select("id, transaction_id, case_kind, state, assigned_confidential_informant")
    .eq("id", id.data)
    .maybeSingle();
  if (!fieldCase || !CASE_LABELS[fieldCase.case_kind]) return { error: "Field case not found." } as const;
  const informant = role === "confidential_informant" && fieldCase.assigned_confidential_informant === data.user.id;
  if (!informant) {
    const { data: own } = requesterMayAct
      ? await admin
          .from("disbursement_requests")
          .select("id")
          .eq("field_case_id", fieldCase.id)
          .eq("requested_by", data.user.id)
          .neq("status", "rejected")
          .maybeSingle()
      : { data: null };
    if (!own) return { error: "Only the assigned Confidential Informant can do this." } as const;
  }
  return { admin, userId: data.user.id, fieldCase } as const;
}

function done(fieldCaseId: string) {
  revalidatePath(`/dashboard/field-cases/${fieldCaseId}`);
  revalidatePath("/dashboard/finance");
  return { success: true } as const;
}

// Before leaving, the Confidential Informant asks the Head Accountant for the estimated expenses.
export async function requestFieldBudget(formData: FormData): Promise<BudgetResult> {
  const context = await assignedInformant(formData.get("field_case_id"));
  if ("error" in context) return { error: String(context.error) };
  const { admin, userId, fieldCase } = context;
  if (["completed", "cancelled"].includes(fieldCase.state)) return { error: "This field case is closed." };
  if (fieldCase.case_kind === "acquisition") {
    return { error: "On a seller meet-up, request the car payment and travel together as purchase funds." };
  }

  const parsed = z
    .object({
      amount: z.coerce.number().positive("Enter the estimated expenses."),
      purpose: z.string().trim().min(1, "Say what the budget covers.").max(1000),
    })
    .safeParse({ amount: formData.get("amount"), purpose: formData.get("purpose") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid budget request." };

  const label = CASE_LABELS[fieldCase.case_kind];
  const { data: request, error } = await admin
    .from("disbursement_requests")
    .insert({
      title: `${label} budget`,
      amount_cents: Math.round(parsed.data.amount * 100),
      purpose: parsed.data.purpose,
      status: "submitted",
      requested_by: userId,
      field_case_id: fieldCase.id,
    })
    .select("id")
    .single();
  if (error) {
    return { error: error.code === "23505" ? "This field case already has a budget request." : error.message };
  }
  await admin.from("disbursement_events").insert({
    disbursement_id: request.id,
    event_kind: "submitted",
    actor_id: userId,
    notes: "Field budget requested.",
  });
  await notify(
    admin,
    { role: "head_accountant" },
    {
      kind: "field_budget_requested",
      title: `${label} budget requested`,
      body: `The Confidential Informant requests ${formatCurrency(parsed.data.amount)} for estimated expenses. Review it in Finance.`,
      transactionId: fieldCase.transaction_id,
    },
  );
  return done(fieldCase.id);
}

// Back at GCE, the Confidential Informant records the cash returned: what the receipts did not use.
export async function recordBudgetReturn(formData: FormData): Promise<BudgetResult> {
  const context = await assignedInformant(formData.get("field_case_id"), true);
  if ("error" in context) return { error: String(context.error) };
  const { admin, fieldCase } = context;

  const returned = z.coerce.number().min(0, "The amount cannot be negative.").safeParse(formData.get("returned"));
  if (!returned.success) return { error: returned.error.issues[0]?.message ?? "Enter the amount returned." };

  const { data: budget } = await admin
    .from("disbursement_requests")
    .select("id, status, amount_cents, returned_at")
    .eq("field_case_id", fieldCase.id)
    .neq("status", "rejected")
    .maybeSingle();
  if (!budget || !budgetReleased(budget.status)) return { error: "The Head Accountant has not released a budget yet." };
  if (budget.returned_at) return { error: "The return is already recorded." };
  const returnedCents = Math.round(returned.data * 100);
  if (returnedCents > Number(budget.amount_cents)) return { error: "You cannot return more than was released." };

  const { error } = await admin
    .from("disbursement_requests")
    .update({ returned_cents: returnedCents, returned_at: new Date().toISOString() })
    .eq("id", budget.id)
    .is("returned_at", null);
  if (error) return { error: error.message };
  await notify(
    admin,
    { role: "head_accountant" },
    {
      kind: "field_budget_returned",
      title: "Field budget excess returned",
      body: `${formatCurrency(returned.data)} of released funds was returned. Confirm you received it in Finance.`,
      transactionId: fieldCase.transaction_id,
    },
  );
  return done(fieldCase.id);
}

// The Head Accountant confirms the returned cash arrived.
export async function confirmBudgetReturn(formData: FormData): Promise<BudgetResult> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: "Not authenticated" };
  if ((await getCurrentRole()) !== "head_accountant") return { error: "Only the Head Accountant confirms returns." };
  const id = z.string().uuid().safeParse(formData.get("disbursement_id"));
  if (!id.success) return { error: "Budget not found." };

  const admin = createAdminClient();
  const { data: budget, error } = await admin
    .from("disbursement_requests")
    .update({ return_confirmed_by: data.user.id, return_confirmed_at: new Date().toISOString() })
    .eq("id", id.data)
    .not("returned_at", "is", null)
    .is("return_confirmed_at", null)
    .select("field_case_id")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!budget) return { error: "No unconfirmed return on this budget." };
  return done(String(budget.field_case_id));
}
