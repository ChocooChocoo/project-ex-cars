"use client";

import { type ReactNode, useState } from "react";

import { getTotalUnreadCount } from "@/app/(customer)/my-inquiries/actions";
import { AppSidebar } from "@/app/(staff)/_components/sidebar/app-sidebar";
import { PageSpinner } from "@/components/auth/page-spinner";
import { SessionProvider, useSession } from "@/components/auth/session-provider";
import { OnboardingTour } from "@/components/onboarding/onboarding-tour";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { usePageData } from "@/lib/api/use-page-data";
import { getClientCookie } from "@/lib/cookie.client";
import { getNotifications } from "@/lib/notifications/client";
import { SIDEBAR_COLLAPSIBLE_VALUES, SIDEBAR_VARIANT_VALUES } from "@/lib/preferences/layout";
import { readPreference } from "@/lib/preferences/read-preference.client";
import { cn } from "@/lib/utils";

import { AccountSwitcher } from "./_components/sidebar/account-switcher";
import { LayoutControls } from "./_components/sidebar/layout-controls";
import { NotificationPopover } from "./_components/sidebar/notification-popover";
import { SearchDialog } from "./_components/sidebar/search-dialog";
import { ThemeSwitcher } from "./_components/sidebar/theme-switcher";

// Phase 4b: client layout (the static build has no server). SessionProvider replaces the server session
// check and redirect; Laravel still authorises every request.
export default function StaffLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <SessionProvider fallback={<PageSpinner />}>
      <StaffShell>{children}</StaffShell>
    </SessionProvider>
  );
}

function StaffShell({ children }: Readonly<{ children: ReactNode }>) {
  const me = useSession();
  const role = me.role;
  // Read once in the browser (the static build has no server): the same cookies getPreference() validated.
  const [{ defaultOpen, variant, collapsible }] = useState(() => ({
    defaultOpen: getClientCookie("sidebar_state") !== "false",
    variant: readPreference("sidebar_variant", SIDEBAR_VARIANT_VALUES, "inset"),
    collapsible: readPreference("sidebar_collapsible", SIDEBAR_COLLAPSIBLE_VALUES, "icon"),
  }));
  const shell = usePageData("staff-shell", async () => {
    const [unreadCount, notifications] = await Promise.all([
      getTotalUnreadCount().catch(() => 0),
      role ? getNotifications(role) : Promise.resolve([]),
    ]);
    return { unreadCount, notifications };
  });
  const unreadCount = shell.data?.unreadCount ?? 0;
  const notifications = shell.data?.notifications ?? [];
  const showTutorial = !me.profile.tutorial_completed_at;

  return (
    <SidebarProvider
      defaultOpen={defaultOpen}
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 68)",
        } as React.CSSProperties
      }
    >
      {/* A failed role lookup must not swap the menu: fall back to the role saved at sign-in. Menu only. */}
      <AppSidebar
        variant={variant}
        collapsible={collapsible}
        userRole={role ?? getClientCookie("gce-role") ?? null}
        unreadCount={unreadCount}
      />
      <SidebarInset
        className={cn(
          "[html[data-content-layout=centered]_&>*]:mx-auto",
          "[html[data-content-layout=centered]_&>*]:w-full",
          "[html[data-content-layout=centered]_&>*]:max-w-screen-2xl",
          "peer-data-[variant=inset]:border",
          "[--dashboard-header-height:--spacing(12)]",
          "min-w-0 overflow-x-hidden",
        )}
      >
        <header
          className={cn(
            "flex h-12 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12",
            // Handle sticky navbar style with conditional classes so blur, background, z-index, and rounded corners remain consistent across all SidebarVariant layouts.
            "[html[data-navbar-style=sticky]_&]:sticky [html[data-navbar-style=sticky]_&]:top-0 [html[data-navbar-style=sticky]_&]:z-50 [html[data-navbar-style=sticky]_&]:overflow-hidden [html[data-navbar-style=sticky]_&]:rounded-t-[inherit] [html[data-navbar-style=sticky]_&]:bg-background/50 [html[data-navbar-style=sticky]_&]:backdrop-blur-md",
          )}
        >
          <div className="flex w-full items-center justify-between px-4 lg:px-6">
            <div className="flex items-center gap-1 lg:gap-2">
              <SidebarTrigger className="-ml-1" />
              <Separator
                orientation="vertical"
                className="mx-2 data-[orientation=vertical]:h-4 data-[orientation=vertical]:self-center"
              />
              <SearchDialog userRole={role} />
            </div>
            <div className="flex items-center gap-2">
              <LayoutControls />
              <ThemeSwitcher />
              <NotificationPopover key={shell.data ? "ready" : "loading"} notifications={notifications} />
              <AccountSwitcher />
            </div>
          </div>
        </header>
        {/* Pages can set data-content-padding="false" to render full-bleed app layouts. */}
        <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden p-4 has-data-[content-padding=false]:p-0 md:p-6 md:has-data-[content-padding=false]:p-0">
          {children}
        </div>
      </SidebarInset>
      {showTutorial ? <OnboardingTour userRole={role} /> : null}
    </SidebarProvider>
  );
}
