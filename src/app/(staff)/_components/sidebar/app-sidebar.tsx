"use client";

import Link from "next/link";

import { CircleHelp, ClipboardList, Command, Database, File, Search, Settings } from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { APP_CONFIG } from "@/config/app-config";
import { type GceRole, ROLE_NAV_ACCESS } from "@/lib/auth/roles";
import { rolePath } from "@/lib/routing/paths";
import { type NavMainItem, sidebarItems } from "@/navigation/sidebar/sidebar-items";
import { usePreferencesStore } from "@/stores/preferences/preferences-provider";

import { NavMain } from "./nav-main";
import { SidebarSupportCard } from "./sidebar-support-card";
import { UserMenu } from "./user-menu";

const _data = {
  navSecondary: [
    { title: "Settings", url: "#", icon: Settings },
    { title: "Get Help", url: "#", icon: CircleHelp },
    { title: "Search", url: "#", icon: Search },
  ],
  documents: [
    { name: "Data Library", url: "#", icon: Database },
    { name: "Reports", url: "#", icon: ClipboardList },
    { name: "Word Assistant", url: "#", icon: File },
  ],
};

function resolveItemUrl(item: NavMainItem, role: string): NavMainItem {
  if ("url" in item && item.url) {
    return { ...item, url: rolePath(role, item.url) };
  }
  if ("subItems" in item && item.subItems) {
    return {
      ...item,
      subItems: item.subItems.map((sub) => ({
        ...sub,
        url: rolePath(role, sub.url),
      })),
    };
  }
  return item;
}

export function AppSidebar({
  userRole,
  unreadCount,
  showQuickCreate = true,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  readonly userRole?: string | null;
  readonly unreadCount?: number;
  readonly showQuickCreate?: boolean;
}) {
  const { sidebarVariant, sidebarCollapsible, isSynced } = usePreferencesStore(
    useShallow((s) => ({
      sidebarVariant: s.sidebarVariant,
      sidebarCollapsible: s.sidebarCollapsible,
      isSynced: s.isSynced,
    })),
  );

  const variant = isSynced ? sidebarVariant : props.variant;
  const collapsible = isSynced ? sidebarCollapsible : props.collapsible;

  const access = userRole ? ROLE_NAV_ACCESS[userRole as GceRole] : null;

  const items = sidebarItems
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (access === null) {
          return (
            item.id === "default" ||
            item.id === "vehicles" ||
            item.id === "content" ||
            item.id === "inspections" ||
            item.id === "showroom" ||
            item.id === "roles" ||
            item.id === "users"
          );
        }
        if (access === "all") return true;
        if (access.has(item.id)) return true;
        if ("subItems" in item && item.subItems) {
          const filtered = item.subItems.filter((sub) => access.has(sub.id));
          return filtered.length > 0;
        }
        return false;
      }),
    }))
    .filter((group) => group.items.length > 0)
    .map((group) => ({
      ...group,
      items: group.items.map((item) => (userRole ? resolveItemUrl(item, userRole) : item)),
    }));

  const brandHref = userRole ? rolePath(userRole, "/dashboard/default") : "/dashboard/default";

  return (
    <Sidebar {...props} variant={variant} collapsible={collapsible}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link prefetch={false} href={brandHref}>
                <Command />
                <span className="font-semibold text-base">{APP_CONFIG.name}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={items} unreadCount={unreadCount} showQuickCreate={showQuickCreate} />
      </SidebarContent>
      <SidebarFooter>
        <SidebarSupportCard />
        <UserMenu />
      </SidebarFooter>
    </Sidebar>
  );
}
