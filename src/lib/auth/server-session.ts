import { getSession } from "./session";

// Server-only helpers for the pages and actions that still render on the Next.js server until their
// phase moves them to the browser (Phases 5-7). The browser equivalent is useSession().

export async function getCurrentUser(): Promise<{ id: string; email: string } | null> {
  const me = await getSession();
  return me ? { id: me.id, email: me.email } : null;
}

export async function getCurrentRole(): Promise<string | null> {
  return (await getSession())?.role ?? null;
}
