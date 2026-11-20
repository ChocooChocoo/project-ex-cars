"use client";

import { TransactionImagePreview } from "@/components/transaction-image-preview";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";

/** One answered part of a seller meet-up inspection, as Laravel's VehicleInspection::pack returns it. */
export interface InspectionPart {
  result_id: string;
  node_id: string;
  name: string;
  level?: string | null;
  parent_id?: string | null;
  status: "good" | "for_repair";
  cost: number | null;
  notes: string | null;
  is_hidden_issue: boolean;
  photos: Array<{ id: string; url: string | null }>;
}

export interface InspectionResultData {
  inspection_id: string;
  inspected_at: string | null;
  findings: string | null;
  parts: InspectionPart[];
  /** Sum of the repair costs, in pesos. */
  total: number;
}

/** The `for_repair` parts, in the order the Mechanic answered them. */
export function inspectionRepairParts(result: InspectionResultData | null | undefined): InspectionPart[] {
  return result ? result.parts.filter((part) => part.status === "for_repair") : [];
}

/**
 * SH-7 / SH-4 / SH-3: one part-by-part inspection result. The Marketing Specialist reads it instead of a
 * free-text issue description, the Mechanic's reconditioning report starts from it, and Phase 8 shows it to the
 * Head Accountant beside the fund request. Declared issues are the parts the seller ticked on the sell form;
 * anything else the Mechanic marks for repair is a hidden issue.
 */
export function InspectionResult({
  result,
  title = "Inspection",
  emptyLabel = "Inspection not reported yet.",
  className,
}: {
  readonly result: InspectionResultData | null | undefined;
  readonly title?: string;
  readonly emptyLabel?: string;
  readonly className?: string;
}) {
  if (!result || result.parts.length === 0) {
    return <p className="text-muted-foreground text-sm">{emptyLabel}</p>;
  }
  const repairs = inspectionRepairParts(result);
  const hidden = repairs.filter((part) => part.is_hidden_issue);
  // A clean car has ~40 good parts: list only what needs repair and fold the rest into one line, so the card (and
  // the Head Accountant's dialog around it) stays short.
  const good = result.parts.filter((part) => part.status === "good");

  return (
    <section className={`flex flex-col gap-3 text-sm ${className ?? ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">{title}</p>
        <div className="flex flex-wrap items-center gap-2">
          {repairs.length === 0 ? (
            <Badge>No issues found</Badge>
          ) : (
            <>
              <Badge variant="destructive">
                {repairs.length} part{repairs.length === 1 ? "" : "s"} need repair
              </Badge>
              {hidden.length > 0 ? <Badge variant="outline">{hidden.length} hidden</Badge> : null}
            </>
          )}
          {repairs.length > 0 ? (
            <span className="text-muted-foreground text-xs tabular-nums">
              Estimated total {formatCurrency(result.total)}
            </span>
          ) : null}
        </div>
      </div>

      {repairs.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {repairs.map((part) => (
            <li key={part.result_id} className="flex flex-col gap-1.5 rounded-md border p-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{part.name}</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {part.status === "good" ? (
                    <Badge variant="secondary">Good condition</Badge>
                  ) : part.is_hidden_issue ? (
                    <Badge variant="destructive">Hidden issue · Needs repair</Badge>
                  ) : (
                    <Badge variant="outline">Declared by seller · Needs repair</Badge>
                  )}
                  {part.cost !== null ? (
                    <span className="text-xs tabular-nums">{formatCurrency(part.cost)}</span>
                  ) : null}
                </div>
              </div>
              {part.notes ? <p className="text-muted-foreground text-xs">{part.notes}</p> : null}
              {part.photos.length > 0 ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {part.photos.map((photo) =>
                    photo.url ? (
                      <TransactionImagePreview
                        key={photo.id}
                        src={photo.url}
                        alt={`${part.name} photo`}
                        triggerClassName="h-20 w-full"
                      />
                    ) : null,
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground text-xs">No photo.</p>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      {good.length > 0 ? (
        <details className="rounded-md border p-2.5">
          <summary className="cursor-pointer">
            {good.length} part{good.length === 1 ? "" : "s"} in good condition
          </summary>
          <p className="mt-1.5 text-muted-foreground text-xs">{good.map((part) => part.name).join(", ")}</p>
        </details>
      ) : null}
    </section>
  );
}
