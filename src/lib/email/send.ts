// T06: transactional email through Resend's HTTP API (no SDK needed). Server only.
// Needs RESEND_API_KEY and EMAIL_FROM (an address on a domain verified in Resend).
export async function sendEmail(message: { to: string; subject: string; text: string }): Promise<string | null> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) return "Email is not set up (RESEND_API_KEY / EMAIL_FROM).";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: message.to, subject: message.subject, text: message.text }),
  });
  return response.ok ? null : `Resend answered ${response.status}: ${await response.text()}`;
}
