import type { GceRole } from "@/lib/auth/roles";
import { GCE_ROLES, STAFF_ROLES } from "@/lib/auth/roles";

export function rolePath(role: string, internalPath: string): string {
  if (internalPath === "/dashboard" || internalPath === "/dashboard/default") {
    return `/${role}/dashboard`;
  }
  if (internalPath.startsWith("/dashboard/")) {
    return `/${role}${internalPath.replace("/dashboard", "")}`;
  }
  return `/${role}${internalPath}`;
}

export function isStaffRole(role: string): boolean {
  return (STAFF_ROLES as readonly string[]).includes(role);
}

export function isKnownRole(role: string): role is GceRole {
  return (GCE_ROLES as readonly string[]).includes(role);
}

export function resolveInternalPath(role: string, segment: string): string {
  // Strip trailing slash for matching.
  const seg = segment.endsWith("/") ? segment.slice(0, -1) : segment;

  if (isStaffRole(role)) {
    if (seg === "dashboard") return "/dashboard";
    if (seg.startsWith("showroom")) return seg.replace("showroom", "/staff-showroom");
    if (seg.startsWith("recommendations")) return seg.replace("recommendations", "/staff-recommendations");
    return `/${seg}`;
  }

  if (seg.startsWith("showroom")) return seg.replace("showroom", "/showroom");
  if (seg.startsWith("inquiries")) return seg.replace("inquiries", "/my-inquiries");
  if (seg.startsWith("my-inquiries")) return `/${seg}`;
  if (seg.startsWith("my-transactions")) return `/${seg}`;
  if (seg.startsWith("recommendations")) return seg.replace("recommendations", "/recommendations");
  if (seg.startsWith("request-a-car")) return `/${seg}`;
  if (seg.startsWith("sell-vehicle")) return `/${seg}`;

  return "/dashboard";
}

export function landingPath(role: string): string {
  if (role === "mechanic") return `/${role}/inspections`;
  if (role === "marketing_specialist" || role === "sales_manager") return `/${role}/vehicles`;
  if (role === "customer" || role === "supplier") return `/${role}/showroom`;
  return `/${role}/dashboard`;
}
