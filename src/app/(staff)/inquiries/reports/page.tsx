import { createServerSupabase } from "@/lib/supabase/server";

import { ReportReview } from "../_components/report-review";

export default async function ReportsPage() {
  const supabase = await createServerSupabase();

  const { data: reports } = await supabase
    .from("message_reports")
    .select("*, reporter:reporter_id(email), inquiry:reported_inquiry_id(*, vehicles(make, model))")
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl leading-none tracking-tight">Message Reports</h1>
        <p className="text-muted-foreground text-sm">Review reported messages and conversations.</p>
      </div>
      <ReportReview reports={(reports as Record<string, unknown>[]) ?? []} />
    </div>
  );
}
