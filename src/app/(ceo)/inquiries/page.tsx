import { InquiryList } from "@/app/(customer)/my-inquiries/_components/inquiry-list";
import { createServerSupabase } from "@/lib/supabase/server";

export default async function StaffInquiriesPage() {
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return null;

  const { data: roleRow } = await supabase.rpc("get_user_roles");
  const roles = (roleRow as { account_id: string; role: string }[] | null) ?? [];
  const myRole = roles.find((r) => r.account_id === user.user.id)?.role;

  let query = supabase.from("inquiries").select("*, vehicles(make, model, year)");

  if (myRole === "sales_manager") {
    query = query.eq("intention_kind", "buy_now");
  }

  const { data: inquiries } = await query.order("updated_at", { ascending: false });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl leading-none tracking-tight">Inquiries Queue</h1>
        <p className="text-muted-foreground text-sm">
          {myRole === "sales_manager"
            ? "Buy Now requests assigned to you."
            : "Customer inquiries waiting for response."}
        </p>
      </div>
      <InquiryList inquiries={(inquiries as Record<string, unknown>[]) ?? []} baseUrl="/inquiries" />
    </div>
  );
}
