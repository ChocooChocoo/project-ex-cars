import { notFound } from "next/navigation";

import { createServerSupabase } from "@/lib/supabase/server";

import { StaffChatView } from "./_components/staff-chat-view";

export default async function StaffChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();

  const { data: inquiry } = await supabase
    .from("inquiries")
    .select("*, vehicles(make, model, year, stock_code)")
    .eq("id", id)
    .single();

  if (!inquiry) notFound();

  const { data: messages } = await supabase
    .from("inquiry_messages")
    .select("*, message_attachments(*)")
    .eq("inquiry_id", id)
    .order("sent_at", { ascending: true });

  const { data: arrangement } = await supabase
    .from("viewing_arrangements")
    .select("*")
    .eq("inquiry_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  return (
    <StaffChatView
      inquiry={inquiry as Record<string, unknown>}
      messages={(messages as Record<string, unknown>[]) ?? []}
      arrangement={arrangement as Record<string, unknown> | null}
    />
  );
}
