"use client";

import { useRequireRole, useSession } from "@/components/auth/session-provider";
import { PageSkeleton } from "@/components/page-skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { browserApi } from "@/lib/api/client";
import { usePageData } from "@/lib/api/use-page-data";

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

export default function ContentPage() {
  const allowed = useRequireRole(["ceo", "marketing_specialist"]);
  const canManage = useSession().role === "marketing_specialist";
  const page = usePageData(allowed ? "content" : "content:denied", () =>
    allowed
      ? browserApi<{ items: Record<string, unknown>[]; vehicles: Record<string, unknown>[] }>(
          "GET",
          "/api/v1/staff/content",
        )
      : Promise.resolve(null),
  );
  if (page.error) throw page.error;
  if (!allowed || !page.data) return <PageSkeleton />;
  const data = page.data;
  const normalizedItems = data.items;

  return (
    <div className="flex flex-col gap-6">
      <ContentSummaryBar items={normalizedItems} />
      <ContentManager items={normalizedItems} vehicles={data.vehicles} canManage={canManage} />
    </div>
  );
}
