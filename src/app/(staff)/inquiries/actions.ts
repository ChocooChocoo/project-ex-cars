"use server";

import { loadThread } from "@/app/(customer)/my-inquiries/actions";
import type { InquiryThreadData } from "@/components/inquiries/types";
import { authorizeAction } from "@/lib/auth/action-guard";
import type { ActionResult } from "@/lib/auth/action-result";

export async function getStaffInquiryThread(inquiryId: string): Promise<ActionResult<InquiryThreadData>> {
  const authorization = await authorizeAction(["ceo", "account_manager", "sales_manager", "marketing_specialist"]);
  if (!authorization.ok) return authorization;
  // Laravel's InquiryPolicy limits the Sales Manager to buy threads and the Marketing Specialist to sell threads.
  return loadThread(inquiryId);
}
