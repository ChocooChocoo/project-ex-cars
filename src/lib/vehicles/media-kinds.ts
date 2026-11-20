export const VEHICLE_MEDIA_KINDS = ["photo", "360_view"] as const;
export type VehicleMediaKind = (typeof VEHICLE_MEDIA_KINDS)[number];

export function isVehicleMediaKind(value: unknown): value is VehicleMediaKind {
  return (VEHICLE_MEDIA_KINDS as readonly unknown[]).includes(value);
}
