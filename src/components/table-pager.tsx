"use client";

import { useState } from "react";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

// T03 constraint: finance tables show at most 10 rows per page, with Previous/Next.
export const PAGE_SIZE = 10;

export function usePagedRows<T>(all: readonly T[], pageSize = PAGE_SIZE) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(all.length / pageSize));
  // Rows can shrink after a refresh (e.g. a request was rejected); never point past the last page.
  const current = Math.min(page, pageCount - 1);
  return {
    rows: all.slice(current * pageSize, (current + 1) * pageSize),
    page: current,
    pageCount,
    pageSize,
    total: all.length,
    setPage,
  };
}

export function TablePager({
  page,
  pageCount,
  pageSize,
  total,
  setPage,
  label,
}: {
  readonly page: number;
  readonly pageCount: number;
  readonly pageSize: number;
  readonly total: number;
  readonly setPage: (page: number) => void;
  /** Names the table for screen readers, e.g. "Disbursement requests". */
  readonly label: string;
}) {
  if (total === 0) return null;
  const first = page * pageSize + 1;
  const last = Math.min(total, (page + 1) * pageSize);

  return (
    <nav aria-label={`${label} pages`} className="flex flex-wrap items-center justify-between gap-3 px-1 pt-3 text-sm">
      <span className="text-muted-foreground tabular-nums">
        {first}–{last} of {total}
      </span>
      <div className="flex items-center gap-4">
        <span className="hidden text-muted-foreground sm:inline">{pageSize} rows per page</span>
        <span className="font-medium tabular-nums">
          Page {page + 1} of {pageCount}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            aria-label="Previous page"
            onClick={() => setPage(page - 1)}
            disabled={page === 0}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            aria-label="Next page"
            onClick={() => setPage(page + 1)}
            disabled={page >= pageCount - 1}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </nav>
  );
}
