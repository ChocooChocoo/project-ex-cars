"use server";

import { errorMessage } from "@/lib/api/errors";
import { apiWrite } from "@/lib/api/server";
import { getSession } from "@/lib/auth/session";

// T06: Skip and Finish both end the tutorial for good.
export async function completeTutorial() {
  try {
    await apiWrite("POST", "/api/v1/me/tutorial");
    return { success: true };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}

export async function needsTutorial(): Promise<boolean> {
  const me = await getSession().catch(() => null);
  return me !== null && !me.profile.tutorial_completed_at;
}
