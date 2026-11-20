"use client";

import type { ReactNode } from "react";

import { PageSpinner } from "@/components/auth/page-spinner";
import { SessionProvider } from "@/components/auth/session-provider";
import { PortalShell } from "@/components/portal-shell";

// Notes Part 1: the supplier portal. Same client shell as the customer portal; Laravel authorises every request
// and refuses a pending or rejected supplier.
export default function SupplierLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <SessionProvider fallback={<PageSpinner />}>
      <PortalShell roles={["supplier"]} tutorial={false}>
        {children}
      </PortalShell>
    </SessionProvider>
  );
}
