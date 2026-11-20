"use client";

import type { ReactNode } from "react";

import { PageSpinner } from "@/components/auth/page-spinner";
import { SessionProvider } from "@/components/auth/session-provider";
import { PortalShell } from "@/components/portal-shell";

// Phase 4b: client layout (the static build has no server). SessionProvider replaces the server session
// check and redirect; Laravel still authorises every request.
export default function CustomerLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <SessionProvider fallback={<PageSpinner />}>
      <PortalShell roles={["customer"]}>{children}</PortalShell>
    </SessionProvider>
  );
}
