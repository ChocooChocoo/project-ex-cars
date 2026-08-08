import type { LucideIcon } from "lucide-react";
import {
  BriefcaseBusiness,
  CarFront,
  KeyRound,
  MapPinned,
  Megaphone,
  ShieldCheck,
  UserCog,
  UserRound,
  Wrench,
} from "lucide-react";

export type UserStatus = "Active" | "Pending invite" | "Deactivated" | "Locked" | "Suspended";

export type UserRow = {
  email: string;
  joinedDate: string;
  lastActive: number;
  name: string;
  role: string;
  status: UserStatus;
  team: string;
  workspace: string[];
};

export const GCE_ROLE_LABELS: Record<string, string> = {
  customer: "Customer",
  supplier: "Supplier",
  ceo: "CEO",
  account_manager: "Account Manager",
  head_accountant: "Head Accountant",
  confidential_informant: "Confidential Informant",
  marketing_specialist: "Marketing Specialist",
  mechanic: "Mechanic",
  sales_manager: "Sales Manager",
  head_security: "Head Security",
};

export function mapAccountState(state: string | null | undefined): UserStatus {
  switch (state) {
    case "active":
      return "Active";
    case "invited":
      return "Pending invite";
    case "suspended":
      return "Suspended";
    case "archived":
    case "deactivated":
      return "Deactivated";
    default:
      return "Active";
  }
}

export const filters = {
  role: ["All", ...Object.values(GCE_ROLE_LABELS)],
  team: ["All", "GCE"],
  status: ["All", "Active", "Pending invite", "Deactivated", "Locked", "Suspended"],
  workspace: ["All", "GCE"],
};

export const roleMeta: Record<string, { className: string; icon: LucideIcon }> = {
  CEO: { className: "text-amber-300", icon: KeyRound },
  "Account Manager": { className: "text-sky-300", icon: UserCog },
  "Head Accountant": { className: "text-emerald-300", icon: BriefcaseBusiness },
  "Confidential Informant": { className: "text-orange-300", icon: MapPinned },
  "Marketing Specialist": { className: "text-violet-300", icon: Megaphone },
  Mechanic: { className: "text-fuchsia-300", icon: Wrench },
  "Sales Manager": { className: "text-rose-300", icon: CarFront },
  "Head Security": { className: "text-cyan-300", icon: ShieldCheck },
  Customer: { className: "text-muted-foreground", icon: UserRound },
  Supplier: { className: "text-muted-foreground", icon: UserRound },
};

export const statusMeta: Record<UserStatus, { badgeClass: string; dotClass: string }> = {
  Active: {
    badgeClass: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    dotClass: "bg-emerald-500",
  },
  "Pending invite": {
    badgeClass: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    dotClass: "bg-amber-500",
  },
  Deactivated: {
    badgeClass: "border-border bg-muted/50 text-muted-foreground",
    dotClass: "bg-muted-foreground",
  },
  Locked: {
    badgeClass: "border-destructive/20 bg-destructive/10 text-destructive",
    dotClass: "bg-destructive",
  },
  Suspended: {
    badgeClass: "border-orange-500/20 bg-orange-500/10 text-orange-600 dark:text-orange-400",
    dotClass: "bg-orange-500",
  },
};
