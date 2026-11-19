// Phase 7: the global financing markup is read and written through Laravel (AdminController, ShowroomController).

// T11: the markup actually charged on a car. `vehicles.financing_markup_pct` overrides the global rate for
// that one car; NULL (or an unreadable value) means "use the global rate".
export function markupFor(vehicle: { financing_markup_pct?: unknown } | null | undefined, globalPct: number): number {
  const own = vehicle?.financing_markup_pct;
  if (own === null || own === undefined || own === "") return globalPct;
  const pct = Number(own);
  return Number.isFinite(pct) && pct >= 0 ? pct : globalPct;
}
