import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TransactionImagePreview } from "@/components/transaction-image-preview";
import { TRANSACTION_STATE_LABELS, type TransactionState } from "@/lib/transactions/state-machine";

export type SellSubmissionListing = {
  readonly transactionId: string;
  readonly state: string;
  readonly openedAt: string;
  readonly vehicleLabel: string | null;
  readonly conditionItems: string[];
  readonly photos: { id: string; is_image: boolean; signed_url: string | null }[];
};

function stateLabel(state: string): string {
  return TRANSACTION_STATE_LABELS[state as TransactionState] ?? state;
}

export function SellSubmissionsList({ submissions }: { readonly submissions: SellSubmissionListing[] }) {
  if (submissions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Sell submissions</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            No customer has sent a car with photos or a condition checklist yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {submissions.map((submission) => (
        <Card key={submission.transactionId}>
          <CardHeader className="flex-row items-start justify-between gap-2">
            <div className="flex flex-col gap-1">
              <CardTitle className="text-lg">{submission.vehicleLabel ?? "Car not recorded"}</CardTitle>
              <p className="text-muted-foreground text-xs tabular-nums">
                #{submission.transactionId.slice(0, 8)} · Sent{" "}
                {new Date(submission.openedAt).toLocaleDateString()} · {stateLabel(submission.state)}
              </p>
            </div>
            <Badge variant="secondary">
              {submission.photos.length} {submission.photos.length === 1 ? "photo" : "photos"}
            </Badge>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {submission.photos.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {submission.photos.map((photo, index) => (
                  <div
                    key={photo.id}
                    className="flex min-h-48 items-center justify-center rounded-md border bg-muted/20 p-2"
                  >
                    {photo.is_image && photo.signed_url ? (
                      <TransactionImagePreview
                        src={photo.signed_url}
                        alt={`${submission.vehicleLabel ?? "Sell submission"} photo ${index + 1}`}
                      />
                    ) : (
                      <p className="text-muted-foreground text-xs">Preview unavailable</p>
                    )}
                  </div>
                ))}
              </div>
            ) : null}

            <div className="flex flex-col gap-2">
              <p className="font-medium text-sm">Customer-reported issues</p>
              {submission.conditionItems.length > 0 ? (
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {submission.conditionItems.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground text-sm">No condition checklist submitted.</p>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
