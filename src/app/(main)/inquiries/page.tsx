import { createServerSupabase } from "@/lib/supabase/server";

import { InquiryList } from "./_components/inquiry-list";

export default async function InquiriesPage() {
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return null;

  const { data: inquiries } = await supabase
    .from("inquiries")
    .select("*, vehicles(make, model, year)")
    .eq("customer_id", user.user.id)
    .order("updated_at", { ascending: false });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl leading-none tracking-tight">My Inquiries</h1>
        <p className="text-muted-foreground text-sm">Your conversations with GCE staff.</p>
      </div>
      <InquiryList inquiries={(inquiries as Record<string, unknown>[]) ?? []} baseUrl="/inquiries" />
    </div>
  );
}
