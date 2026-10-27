import { format } from "date-fns";

// T03 D1: the delivery team's last shared position, for staff and the buyer.
export function DeliveryLastSeen({
  lat,
  lng,
  at,
}: {
  readonly lat: unknown;
  readonly lng: unknown;
  readonly at: unknown;
}) {
  if (typeof lat !== "number" || typeof lng !== "number" || typeof at !== "string") return null;
  return (
    <p className="text-xs">
      Last seen {format(new Date(at), "MMM d, h:mm a")} ·{" "}
      <a
        href={`https://www.google.com/maps?q=${lat},${lng}`}
        target="_blank"
        rel="noreferrer"
        className="text-primary underline underline-offset-2"
      >
        Open in Google Maps
      </a>
    </p>
  );
}
