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
  if (isStaffRole(role)) {
    if (segment === "dashboard") return "/dashboard/default";
    if (segment === "showroom") return "/dashboard/showroom";
    return `/dashboard/${segment}`;
  }

  if (segment === "showroom") return "/showroom";
  if (segment === "inquiries") return "/inquiries";
  if (segment === "recommendations") return "/recommendations";

  return "/dashboard/default";
}

export function landingPath(role: string): string {
  if (role === "mechanic") return `/${role}/inspections`;
  if (role === "marketing_specialist" || role === "sales_manager") return `/${role}/vehicles`;
  if (role === "customer" || role === "supplier") return `/${role}/showroom`;
  return `/${role}/dashboard`;
}
