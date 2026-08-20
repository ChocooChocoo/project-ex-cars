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

  // Supplier isolated overview — maps /supplier/overview → /overview.
  // Choice: isolated (supplier)/overview route group avoids leaking staff layout/header
  // vs (staff)/supplier-overview reuse. Builder creates src/app/(supplier)/overview/page.tsx.
  // Also accepts supplier-overview alias for staff-reuse fallback.
  if (role === "supplier") {
    if (seg === "overview" || seg.startsWith("overview/")) {
      return seg === "overview" ? "/overview" : seg.replace("overview", "/overview");
    }
    if (seg === "supplier-overview" || seg.startsWith("supplier-overview")) {
      return seg === "supplier-overview"
        ? "/supplier-overview"
        : seg.replace("supplier-overview", "/supplier-overview");
    }
  }

  if (seg.startsWith("showroom")) return seg.replace("showroom", "/showroom");
  if (seg.startsWith("inquiries")) return seg.replace("inquiries", "/my-inquiries");
  if (seg.startsWith("my-inquiries")) return `/${seg}`;
  if (seg.startsWith("my-transactions")) return `/${seg}`;
  if (seg.startsWith("favourites")) return `/${seg}`;
  if (seg.startsWith("recommendations")) return seg.replace("recommendations", "/recommendations");
  if (seg.startsWith("request-a-car")) return `/${seg}`;
  if (seg.startsWith("sell-vehicle")) return `/${seg}`;
  if (seg.startsWith("supplier-messages")) return "/supplier-messages";

  return "/dashboard";
}

export function landingPath(role: string): string {
  if (role === "mechanic") return `/${role}/inspections`;
  if (role === "marketing_specialist" || role === "sales_manager") return `/${role}/vehicles`;
  if (role === "supplier") return `/${role}/overview`;
  if (role === "customer") return `/${role}/showroom`;
  return `/${role}/dashboard`;
}
