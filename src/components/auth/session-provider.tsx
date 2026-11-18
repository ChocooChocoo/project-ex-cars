"use client";

import { createContext, type ReactNode, useContext, useEffect, useState, useSyncExternalStore } from "react";

import { useRouter } from "next/navigation";

import { browserApi } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { revalidateVersion, subscribeRevalidate } from "@/lib/api/revalidate";
import type { Me } from "@/lib/api/types";
import { LOGIN_PATH } from "@/lib/api/use-page-data";
import type { GceRole } from "@/lib/auth/roles";

const SessionContext = createContext<Me | null>(null);

/**
 * Client replacement for the server layouts' session check (and src/proxy.ts's login redirect): loads
 * /api/v1/me once, sends a signed-out or inactive user to login, and renders children only when signed in.
 * Laravel still authorises every request; this only decides what to show.
 */
export function SessionProvider({
  children,
  fallback,
}: {
  readonly children: ReactNode;
  readonly fallback: ReactNode;
}) {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [failure, setFailure] = useState<unknown>(null);
  // Reload after a write (profile, avatar, tutorial), like the server layouts re-read the session.
  const version = useSyncExternalStore(subscribeRevalidate, revalidateVersion, () => 0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `version` is the reload trigger.
  useEffect(() => {
    let live = true;
    browserApi<Me>("GET", "/api/v1/me").then(
      (result) => {
        if (live) setMe(result);
      },
      (error: unknown) => {
        if (!live) return;
        if (error instanceof ApiError && (error.isAuthFailure || error.status === 403)) router.replace(LOGIN_PATH);
        else setFailure(error);
      },
    );
    return () => {
      live = false;
    };
  }, [router, version]);

  // An outage goes to the error boundary, as it did from the server layout; it is not "signed out".
  if (failure) throw failure;
  if (!me) return fallback;
  return <SessionContext.Provider value={me}>{children}</SessionContext.Provider>;
}

/** The signed-in account. Only valid inside SessionProvider (both app layouts). */
export function useSession(): Me {
  const me = useContext(SessionContext);
  if (!me) throw new Error("useSession() used outside SessionProvider");
  return me;
}

/** Client form of requireRole(): sends other roles to /unauthorized. Returns whether the page may render. */
export function useRequireRole(allowed: readonly GceRole[]): boolean {
  const me = useSession();
  const router = useRouter();
  const ok = me.role !== null && allowed.includes(me.role);
  useEffect(() => {
    if (!ok) router.replace("/unauthorized");
  }, [ok, router]);
  return ok;
}
