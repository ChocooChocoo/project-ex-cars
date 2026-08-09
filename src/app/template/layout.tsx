import type { ReactNode } from "react";

import Link from "next/link";

import {
  Banknote,
  Calendar,
  ChartBar,
  Command,
  Fingerprint,
  Forklift,
  Gauge,
  GraduationCap,
  Kanban,
  LayoutDashboard,
  ListTodo,
  type LucideIcon,
  Mail,
  MessageSquare,
  Milestone,
  ReceiptText,
  Server,
  Shield,
  ShoppingBag,
  Users,
} from "lucide-react";

import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { APP_CONFIG } from "@/config/app-config";
import { cn } from "@/lib/utils";

interface TemplateNavLink {
  title: string;
  url: string;
  icon?: LucideIcon;
}

interface TemplateNavGroup {
  label?: string;
  items: TemplateNavLink[];
}

const TEMPLATE_NAV: TemplateNavGroup[] = [
  {
    label: "Dashboards",
    items: [
      { title: "Default", url: "/template/dashboard/default", icon: LayoutDashboard },
      { title: "Academy", url: "/template/dashboard/academy", icon: GraduationCap },
      { title: "Analytics", url: "/template/dashboard/analytics", icon: Gauge },
      { title: "Calendar", url: "/template/dashboard/calendar", icon: Calendar },
      { title: "CRM", url: "/template/dashboard/crm", icon: ChartBar },
      { title: "E-commerce", url: "/template/dashboard/ecommerce", icon: ShoppingBag },
      { title: "Finance", url: "/template/dashboard/finance", icon: Banknote },
      { title: "Infrastructure", url: "/template/dashboard/infrastructure", icon: Server },
      { title: "Invoice", url: "/template/dashboard/invoice", icon: ReceiptText },
      { title: "Kanban", url: "/template/dashboard/kanban", icon: Kanban },
      { title: "Logistics", url: "/template/dashboard/logistics", icon: Forklift },
      { title: "Productivity", url: "/template/dashboard/productivity", icon: ListTodo },
      { title: "Roadmap", url: "/template/dashboard/roadmap", icon: Milestone },
    ],
  },
  {
    label: "Legacy",
    items: [
      { title: "Default V1", url: "/template/dashboard/default-v1", icon: LayoutDashboard },
      { title: "CRM V1", url: "/template/dashboard/crm-v1", icon: ChartBar },
      { title: "Finance V1", url: "/template/dashboard/finance-v1", icon: Banknote },
      { title: "Analytics V1", url: "/template/dashboard/analytics-v1", icon: Gauge },
    ],
  },
  {
    label: "Apps",
    items: [
      { title: "Chat", url: "/template/chat", icon: MessageSquare },
      { title: "Mail", url: "/template/mail", icon: Mail },
      { title: "Roles", url: "/template/dashboard/roles", icon: Shield },
      { title: "Users", url: "/template/dashboard/users", icon: Users },
    ],
  },
  {
    label: "Auth",
    items: [
      { title: "Login V1", url: "/template/auth/v1/login", icon: Fingerprint },
      { title: "Register V1", url: "/template/auth/v1/register", icon: Fingerprint },
      { title: "Login V2", url: "/template/auth/v2/login", icon: Fingerprint },
      { title: "Register V2", url: "/template/auth/v2/register", icon: Fingerprint },
    ],
  },
];

export default function TemplateLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 68)",
        } as React.CSSProperties
      }
    >
      <Sidebar>
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link prefetch={false} href="/template/dashboard/default">
                  <Command />
                  <span className="font-semibold text-base">{APP_CONFIG.name} — Templates</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          {TEMPLATE_NAV.map((group) => (
            <SidebarGroup key={group.label ?? group.items[0]?.title}>
              {group.label && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <SidebarMenuItem key={item.url}>
                        <SidebarMenuButton asChild>
                          <Link prefetch={false} href={item.url}>
                            {Icon && <Icon />}
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>
        <SidebarFooter />
      </Sidebar>
      <SidebarInset className={cn("min-w-0 overflow-x-hidden", "[--dashboard-header-height:--spacing(12)]")}>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b">
          <div className="flex w-full items-center justify-between px-4 lg:px-6">
            <div className="flex items-center gap-1 lg:gap-2">
              <SidebarTrigger className="-ml-1" />
              <Separator
                orientation="vertical"
                className="mx-2 data-[orientation=vertical]:h-4 data-[orientation=vertical]:self-center"
              />
              <span className="text-muted-foreground text-sm">Unauthenticated template preview</span>
            </div>
          </div>
        </header>
        <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden p-4 has-data-[content-padding=false]:p-0 md:p-6 md:has-data-[content-padding=false]:p-0">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
