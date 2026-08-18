import type { ReportKind } from "@/lib/validation/phase6";

export interface ReportRow {
  id: string;
  title: string;
  report_kind: ReportKind;
  description: string | null;
  status: "draft" | "submitted" | "reviewed" | "archived";
  period_start: string | null;
  period_end: string | null;
  created_at: string;
}
