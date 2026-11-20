"use client";

import { apiAction, laravelForm } from "@/lib/api/action";
import { browserApi } from "@/lib/api/client";
import type { SupplierPost } from "@/lib/suppliers/supplier-posts";
import { compressFormFiles } from "@/lib/uploads/compress-image";

export interface SupplierDashboard {
  company_name: string;
  counts: { transactions: number; posted: number; purchased: number };
  posts: SupplierPost[];
}

export function getSupplierDashboard(): Promise<SupplierDashboard> {
  return browserApi<SupplierDashboard>("GET", "/api/v1/supplier/dashboard");
}

/** Photos are compressed in the browser first (2 MiB cap per file). */
export async function createSupplierPost(formData: FormData) {
  return apiAction<{ id: string }>("/supplier/posts", laravelForm(await compressFormFiles(formData)));
}

export function updateSupplierPost(id: string, fields: Record<string, string>) {
  return apiAction(`/supplier/posts/${id}`, fields);
}

export function withdrawSupplierPost(id: string) {
  return apiAction(`/supplier/posts/${id}/withdraw`);
}
