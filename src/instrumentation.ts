// Next.js runs register() once when a server instance starts.
// Vercel runs in UTC while users' browsers run in Asia/Manila, so server-rendered times differed from the
// client render (React hydration error #418). Node re-reads its time zone when process.env.TZ is assigned.
// ponytail: users outside PHT still see a mismatch; pass timeZone "Asia/Manila" to each formatter if that matters.
export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") process.env.TZ = "Asia/Manila";
}
