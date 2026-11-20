import { format } from "date-fns";

// T03 D1: the delivery team's last shared position, for staff and the buyer. SH-8: shown here as coordinates,
// never as an external map link — the in-app map beside it is the only map.
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
      <span className="tabular-nums">
        {lat.toFixed(5)}, {lng.toFixed(5)}
      </span>
    </p>
  );
}
