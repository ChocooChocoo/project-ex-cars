"use client";

import { browserApi } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";

// T06: Skip and Finish both end the tutorial for good. (Whether to show it comes from the session:
// `profile.tutorial_completed_at`, read by the layouts.)
export async function completeTutorial() {
  try {
    await browserApi("POST", "/api/v1/me/tutorial");
    return { success: true };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}
