import { isStaffRole, landingPath, rolePath } from "@/lib/routing/paths";

// Staff see "GCE Admin" and go back to their dashboard; customers and suppliers see the public name and go to
// their own home page (the customer's is the Showroom).
export function brandFor(role: string | null | undefined): { label: string; href: string } {
  if (!role) return { label: "Global Car Exchange", href: "/dashboard/default" };
  if (isStaffRole(role)) return { label: "GCE Admin", href: rolePath(role, "/dashboard") };
  return { label: "Global Car Exchange", href: landingPath(role) };
}
