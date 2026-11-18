"use client";

// Phase 5: the last shared position of a delivery or recovery, read from Laravel. The buyer, the named team and
// the office roles may read it; the polling component calls this every 15 seconds.

import { browserApi } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";

type LocationResult = { error: string } | { success: true; lat: number | null; lng: number | null; at: string | null };

export async function getFieldCaseLocation(fieldCaseId: string): Promise<LocationResult> {
  try {
    return await browserApi<LocationResult>("GET", `/api/v1/field-cases/${encodeURIComponent(fieldCaseId)}/location`);
  } catch (error) {
    return { error: errorMessage(error) };
  }
}
