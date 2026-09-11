import { TransactionImagePreview } from "@/components/transaction-image-preview";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type SellPhoto = {
  readonly id: string;
  readonly is_image: boolean;
  readonly signed_url: string | null;
};

export function InspectionSellMedia({
  photos,
  conditionItems,
}: {
  readonly photos: SellPhoto[];
  readonly conditionItems: string[];
}) {
  if (photos.length === 0 && conditionItems.length === 0) return null;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-lg">Vehicle photos & condition</CardTitle>
        <Badge variant="secondary">
          {photos.length} {photos.length === 1 ? "photo" : "photos"}
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {photos.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {photos.map((photo, index) => (
              <div
                key={photo.id}
                className="flex min-h-48 items-center justify-center rounded-md border bg-muted/20 p-2"
              >
                {photo.is_image && photo.signed_url ? (
                  <TransactionImagePreview src={photo.signed_url} alt={`Sell vehicle photo ${index + 1}`} />
                ) : (
                  <p className="text-muted-foreground text-xs">Preview unavailable</p>
                )}
              </div>
            ))}
          </div>
        ) : null}
        <div className="flex flex-col gap-2">
          <p className="font-medium text-sm">Customer-selected condition</p>
          {conditionItems.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {conditionItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">No condition checklist submitted.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
