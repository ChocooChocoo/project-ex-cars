import { getCurrentRole } from "@/app/auth/actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/guards";
import { createServerSupabase } from "@/lib/supabase/server";

import { ContentManager } from "./_components/content-manager";

export function getContentSummary(items: Record<string, unknown>[]) {
  const total = items.length;
  const draft = items.filter((item) => item.publication_state === "draft").length;
  const published = items.filter((item) => item.publication_state === "published").length;
  const archived = items.filter((item) => item.publication_state === "archived").length;
  const pendingReview = draft;
  return { total, draft, published, archived, pendingReview };
}

function ContentSummaryBar({ items }: { readonly items: Record<string, unknown>[] }) {
  const summary = getContentSummary(items);
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-4" data-testid="content-summary-bar">
      <Card size="sm">
        <CardContent className="flex flex-col gap-1 pt-3">
          <span className="text-muted-foreground text-xs">Total</span>
          <span className="font-semibold text-2xl">{summary.total}</span>
          <Badge variant="secondary" className="w-fit">
            {summary.total} items
          </Badge>
        </CardContent>
      </Card>
      <Card size="sm">
        <CardContent className="flex flex-col gap-1 pt-3">
          <span className="text-muted-foreground text-xs">Pending Review</span>
          <span className="font-semibold text-2xl">{summary.pendingReview}</span>
          <Badge variant="outline" className="w-fit">
            draft
          </Badge>
        </CardContent>
      </Card>
      <Card size="sm">
        <CardContent className="flex flex-col gap-1 pt-3">
          <span className="text-muted-foreground text-xs">Published</span>
          <span className="font-semibold text-2xl text-green-600 dark:text-green-400">{summary.published}</span>
          <Badge variant="default" className="w-fit">
            live
          </Badge>
        </CardContent>
      </Card>
      <Card size="sm">
        <CardContent className="flex flex-col gap-1 pt-3">
          <span className="text-muted-foreground text-xs">Archived</span>
          <span className="font-semibold text-2xl">{summary.archived}</span>
          <Badge variant="secondary" className="w-fit">
            archived
          </Badge>
        </CardContent>
      </Card>
    </div>
  );
}

export default async function ContentPage() {
  await requireRole(["ceo", "marketing_specialist"]);
  const supabase = await createServerSupabase();
  const canManage = (await getCurrentRole()) === "marketing_specialist";

  const { data: items } = await supabase.from("content_items").select("*").order("created_at", { ascending: false });

  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("id, make, model, year")
    .order("created_at", { ascending: false });

  const normalizedItems = (items as Record<string, unknown>[]) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <ContentSummaryBar items={normalizedItems} />
      <ContentManager
        items={normalizedItems}
        vehicles={(vehicles as Record<string, unknown>[]) ?? []}
        canManage={canManage}
      />
    </div>
  );
}
