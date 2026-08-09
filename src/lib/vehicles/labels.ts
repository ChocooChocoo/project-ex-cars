export const listingStateMeta: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  draft: { label: "Draft", variant: "secondary" },
  inspecting: { label: "Inspecting", variant: "outline" },
  repairing: { label: "Repairing", variant: "outline" },
  awaiting_price_approval: { label: "Awaiting Approval", variant: "secondary" },
  available: { label: "Available", variant: "default" },
  reserved: { label: "Reserved", variant: "secondary" },
  sold: { label: "Sold", variant: "outline" },
  archived: { label: "Archived", variant: "outline" },
};

export function listingStateLabel(state: string | null | undefined): string {
  if (!state) return "—";
  return (listingStateMeta[state] ?? { label: state.replace(/_/g, " ") }).label;
}

export function listingStateVariant(
  state: string | null | undefined,
): "default" | "secondary" | "outline" | "destructive" {
  if (!state) return "outline";
  return (listingStateMeta[state] ?? { variant: "outline" }).variant;
}
