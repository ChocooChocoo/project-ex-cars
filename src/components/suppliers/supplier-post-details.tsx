"use client";

import { Badge } from "@/components/ui/badge";
import { SUPPLIER_POST_STATE_LABELS, type SupplierPost, supplierPostTitle } from "@/lib/suppliers/supplier-posts";
import { formatCurrency } from "@/lib/utils";

/** One supplier post's photos and details, shared by the supplier portal and the staff Supplier Vehicles page. */
export function SupplierPostDetails({ post }: { readonly post: SupplierPost }) {
  const photos = post.photos.filter((url): url is string => Boolean(url));
  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-medium text-base">{supplierPostTitle(post)}</h3>
        <Badge variant="outline">{SUPPLIER_POST_STATE_LABELS[post.state] ?? post.state}</Badge>
      </div>
      {photos.length > 0 ? (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Vehicle photos">
          {photos.map((url, index) => (
            <li key={url}>
              <a href={url} target="_blank" rel="noreferrer">
                {/* biome-ignore lint/performance/noImgElement: short-lived signed private links, not optimizable */}
                <img
                  src={url}
                  alt={`${supplierPostTitle(post)}, view ${index + 1}`}
                  className="aspect-4/3 w-full rounded-md border object-cover"
                />
              </a>
            </li>
          ))}
        </ul>
      ) : null}
      <dl className="grid gap-2 sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground text-xs">Asking price</dt>
          <dd className="tabular-nums">{formatCurrency(post.asking_price)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">Mileage</dt>
          <dd className="tabular-nums">{post.mileage.toLocaleString("en-PH")} km</dd>
        </div>
        {post.company_name ? (
          <div>
            <dt className="text-muted-foreground text-xs">Supplier</dt>
            <dd>
              {post.company_name}
              {post.supplier_name ? (
                <span className="block text-muted-foreground text-xs">
                  {post.supplier_name}
                  {post.supplier_phone ? ` · ${post.supplier_phone}` : ""}
                </span>
              ) : null}
            </dd>
          </div>
        ) : null}
      </dl>
      {post.description ? <p className="whitespace-pre-line">{post.description}</p> : null}
    </div>
  );
}
