import { render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { SidebarProvider } from "@/components/ui/sidebar";

import { AppSidebar } from "./app-sidebar";

vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("@/stores/preferences/preferences-provider", () => ({
  usePreferencesStore: () => ({ isSynced: false }),
}));

vi.mock("./nav-main", () => ({ NavMain: () => null }));
vi.mock("./user-menu", () => ({ UserMenu: () => null }));

it.each([
  ["sales_manager", "/sales_manager/dashboard"],
  ["customer", "/customer/showroom"],
  ["supplier", "/supplier/portal"],
])("uses both themed wordmarks in the %s portal", (role, href) => {
  render(
    <SidebarProvider>
      <AppSidebar userRole={role} collapsible="icon" />
    </SidebarProvider>,
  );

  const link = screen.getByRole("link", { name: /Global Car Exchange/ });
  expect(link).toHaveAttribute("href", href);
  const [light, dark] = within(link).getAllByAltText("Global Car Exchange");
  expect(light).toHaveAttribute("src", "/assets/logo/GCE-LOGO-LIGHTMODE.png");
  expect(light).toHaveClass("dark:hidden");
  expect(dark).toHaveAttribute("src", "/assets/logo/GCE-LOGO-DARKMODE.png");
  expect(dark).toHaveClass("hidden", "dark:block");
});
