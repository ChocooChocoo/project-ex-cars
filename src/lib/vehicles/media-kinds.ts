// Must match the vehicle_media.media_kind CHECK (20261029100000_t04_vehicle_media_interior.sql).
export const VEHICLE_MEDIA_KINDS = ["photo", "360_view", "interior"] as const;
export type VehicleMediaKind = (typeof VEHICLE_MEDIA_KINDS)[number];

export function isVehicleMediaKind(value: unknown): value is VehicleMediaKind {
  return (VEHICLE_MEDIA_KINDS as readonly unknown[]).includes(value);
}
