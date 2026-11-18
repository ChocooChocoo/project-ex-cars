"use client";

import { loadThread } from "@/app/(customer)/my-inquiries/actions";
import type { InquiryThreadData } from "@/components/inquiries/types";
import type { ActionResult } from "@/lib/auth/action-result";

// Laravel's InquiryPolicy decides access: the CEO and Account Manager read all threads, the Sales Manager
// buy threads, the Marketing Specialist sell threads; anything else is a 404 ("Inquiry not found").
export async function getStaffInquiryThread(inquiryId: string): Promise<ActionResult<InquiryThreadData>> {
  return loadThread(inquiryId);
}
