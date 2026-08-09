"use server";

import { z } from "zod";

import type { InquiryThreadData } from "@/components/inquiries/types";
import { authorizeAction } from "@/lib/auth/action-guard";
import { type ActionResult, failure, notFound, success } from "@/lib/auth/action-result";
import { createServerSupabase } from "@/lib/supabase/server";

const inquiryIdSchema = z.string().uuid();

export async function getStaffInquiryThread(inquiryId: string): Promise<ActionResult<InquiryThreadData>> {
  const authorization = await authorizeAction(["ceo", "account_manager", "sales_manager"]);
  if (!authorization.ok) return authorization;

  const parsedId = inquiryIdSchema.safeParse(inquiryId);
  if (!parsedId.success) return failure("validation_error", "Invalid inquiry.");

  const supabase = await createServerSupabase();
  let inquiryQuery = supabase
    .from("inquiries")
    .select("*, vehicles(make, model, year, stock_code), profiles(full_name)")
    .eq("id", parsedId.data);

  if (authorization.data.role === "sales_manager") {
    inquiryQuery = inquiryQuery.eq("intention_kind", "buy_now");
  }

  const { data: inquiry, error: inquiryError } = await inquiryQuery.maybeSingle();
  if (inquiryError) return failure("load_failed", "Could not load this inquiry.");
  if (!inquiry) return notFound("Inquiry");

  const { data: messages, error: messagesError } = await supabase
    .from("inquiry_messages")
    .select("*, message_attachments(*)")
    .eq("inquiry_id", parsedId.data)
    .order("sent_at", { ascending: true });
  if (messagesError) return failure("load_failed", "Could not load this conversation.");

  const { data: arrangement, error: arrangementError } = await supabase
    .from("viewing_arrangements")
    .select("*")
    .eq("inquiry_id", parsedId.data)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (arrangementError) return failure("load_failed", "Could not load this conversation.");

  return success({
    inquiry: inquiry as Record<string, unknown>,
    messages: (messages as Record<string, unknown>[]) ?? [],
    arrangement: arrangement as Record<string, unknown> | null,
  });
}
