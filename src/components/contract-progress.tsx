import { format } from "date-fns";

import {
  isDirectPayment,
  isFieldArrangement,
  isHalfwayCashRequest,
  missingContractCopies,
} from "@/lib/transactions/buy-flow";

type Row = Record<string, unknown>;

// What has been recorded about a sale's contract so far: signing, the copies kept and, in the field,
// the meeting and the money. Shown to staff on the request and to the team on the field case.
export function ContractProgress({ details, handover }: { readonly details: Row | null; readonly handover: Row }) {
  const field = isFieldArrangement(details);
  const steps: [string, unknown][] = [
    ...(field ? ([["Buyer met", handover.buyer_met_at]] as [string, unknown][]) : []),
    ["Contract signed", handover.contract_signed_at],
    ...(field
      ? ([
          ["Signing reported by the Confidential Informant", handover.signing_reported_at],
          ["Signed copy kept by the Confidential Informant", handover.ci_copy_at],
        ] as [string, unknown][])
      : []),
    ...(isHalfwayCashRequest(details)
      ? ([["Signed copy kept by the Mechanic", handover.mechanic_copy_at]] as [string, unknown][])
      : []),
    ...(field && isDirectPayment(details)
      ? ([["Payment reported to the Sales Manager", handover.cash_reported_at]] as [string, unknown][])
      : []),
  ];
  const missing = handover.contract_state === "signed" ? missingContractCopies(details, handover) : [];

  return (
    <div className="flex flex-col gap-2">
      <dl className="flex flex-col divide-y rounded-md border">
        {steps.map(([label, at]) => (
          <div key={label} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-3 py-2">
            <dt>{label}</dt>
            <dd className={at ? "tabular-nums" : "text-muted-foreground"}>
              {at ? format(new Date(at as string), "MMM d, yyyy h:mm a") : "Not yet"}
            </dd>
          </div>
        ))}
      </dl>
      {missing.length > 0 ? (
        <p role="status" className="font-medium">
          The signed contract is not fully kept. Still to record a copy: {missing.join(" and ")}.
        </p>
      ) : null}
    </div>
  );
}
