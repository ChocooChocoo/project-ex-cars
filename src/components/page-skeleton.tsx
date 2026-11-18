import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shown while a page's data loads in the browser (Phase 4b static build). Built only from the existing
 * Skeleton: a title line, a subtitle line and a content block, inside the page's own layout.
 */
export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-busy="true" aria-label="Loading">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <Skeleton className="h-96 w-full" />
    </div>
  );
}
