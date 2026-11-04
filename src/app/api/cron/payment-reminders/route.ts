import { sendEmail } from "@/lib/email/send";
import { reminderDueDates, reminderMessage } from "@/lib/payments/reminders";
import { createAdminClient } from "@/lib/supabase/admin";

// T06: daily job (vercel.json cron) that emails each financing buyer 7, 3 and 1 day before an installment
// is due, and leaves the same reminder in their notifications. Vercel sends `Authorization: Bearer
// $CRON_SECRET`; anything else is refused.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Row = {
  id: string;
  due_date: string;
  amount_due: number | string;
  installment_accounts: {
    transactions: {
      id: string;
      customer_id: string;
      vehicles: { make: string; model: string; year: number } | null;
    } | null;
  } | null;
};

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const windows = reminderDueDates(new Date());
  const { data, error } = await admin
    .from("installments")
    .select(
      "id, due_date, amount_due, installment_accounts!inner(transactions!inner(id, customer_id, vehicles(make, model, year)))",
    )
    .in("due_date", [...windows.keys()])
    .not("state", "in", "('paid','waived')");
  if (error) return Response.json({ error: error.message }, { status: 500 });

  let sent = 0;
  const failures: string[] = [];
  for (const row of (data ?? []) as unknown as Row[]) {
    const days = windows.get(row.due_date);
    const tx = row.installment_accounts?.transactions;
    if (!days || !tx) continue;

    // Claim the reminder first: the primary key lets only one run send it.
    const { data: claimed } = await admin
      .from("payment_reminders_sent")
      .upsert({ installment_id: row.id, days_before: days }, { ignoreDuplicates: true })
      .select("installment_id");
    if (!claimed?.length) continue;

    const [{ data: user }, { data: profile }] = await Promise.all([
      admin.auth.admin.getUserById(tx.customer_id),
      admin.from("profiles").select("full_name").eq("id", tx.customer_id).maybeSingle(),
    ]);
    const car = tx.vehicles ? `${tx.vehicles.year} ${tx.vehicles.make} ${tx.vehicles.model}` : "your car";
    const message = reminderMessage({
      name: (profile?.full_name as string | null) ?? null,
      amount: Number(row.amount_due),
      dueDate: row.due_date,
      days,
      car,
    });

    const email = user.user?.email;
    const emailError = email ? await sendEmail({ to: email, ...message }) : "The buyer has no email address.";
    if (emailError) {
      // Release the claim so a manual rerun today can try again.
      await admin.from("payment_reminders_sent").delete().eq("installment_id", row.id).eq("days_before", days);
      failures.push(`${row.id}: ${emailError}`);
      continue;
    }

    await admin.from("notifications").insert({
      recipient_id: tx.customer_id,
      kind: "installment_reminder",
      title: "Payment reminder",
      body: message.subject.replace("GCE payment reminder: ", ""),
      reference_table: "transactions",
      reference_id: tx.id,
    });
    sent++;
  }

  return Response.json({ sent, failed: failures.length, failures });
}
