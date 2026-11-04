// T06: VIN, plate, engine and chassis numbers stay in GCE's records. Showroom pages drop them before the
// row reaches the browser.
// ponytail: RLS is per row, so a signed-in user could still read these columns through the API; move them
// to a staff-only table if that exposure matters.
export const PRIVATE_VEHICLE_FIELDS = ["vin", "plate_number", "engine_number", "chassis_number"] as const;

export function withoutIdentifiers<T extends Record<string, unknown>>(
  vehicle: T,
): Omit<T, (typeof PRIVATE_VEHICLE_FIELDS)[number]> {
  const copy: Record<string, unknown> = { ...vehicle };
  for (const field of PRIVATE_VEHICLE_FIELDS) delete copy[field];
  return copy as Omit<T, (typeof PRIVATE_VEHICLE_FIELDS)[number]>;
}
