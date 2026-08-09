import { cookies } from "next/headers";

import { createServerClient } from "@supabase/ssr";

function getEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  if (!key) throw new Error("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not set");
  return { url, key };
}

/**
 * Read-only server client for Server Components (pages, layouts).
 * Cookies can only be modified in Server Actions or Route Handlers,
 * so setAll is intentionally a no-op here — middleware refreshes tokens.
 */
export async function createServerSupabase() {
  const cookieStore = await cookies();
  const { url, key } = getEnv();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {
        // no-op: cannot write cookies from a Server Component
      },
    },
  });
}

/**
 * Read-write server client for Server Actions and Route Handlers.
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  const { url, key } = getEnv();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set(name, value, options);
        }
      },
    },
  });
}
