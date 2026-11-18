"use client";

import { useEffect, useState } from "react";

import { browserApi } from "./client";
import type { Me } from "./types";

/** The shape the sidebar menus read (formerly Supabase `user` + `user_metadata`). */
export interface AccountSummary {
  email: string;
  user_metadata: { full_name?: string; avatar_url?: string };
}

/** Signed-in account for client components; null while loading or when signed out. */
export function useAccountSummary(): AccountSummary | null {
  const [summary, setSummary] = useState<AccountSummary | null>(null);
  useEffect(() => {
    let live = true;
    browserApi<Me>("GET", "/api/v1/me")
      .then((me) => {
        if (live) {
          setSummary({
            email: me.email,
            user_metadata: {
              full_name: me.profile.full_name ?? undefined,
              avatar_url: me.profile.avatar_url ?? undefined,
            },
          });
        }
      })
      .catch(() => {
        // Signed out or unreachable: the menu simply does not render, as before.
      });
    return () => {
      live = false;
    };
  }, []);
  return summary;
}
