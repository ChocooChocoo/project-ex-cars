import { describe, expect, it } from "vitest";

import { GET } from "./route";

function call(query: string) {
  return GET(new Request(`https://gce.example/auth/callback?${query}`) as never);
}

// The Supabase PKCE callback is retired; emailed links now use /auth/confirm.
describe("auth callback (retired)", () => {
  it("forwards a Laravel signed link to /auth/confirm", async () => {
    const response = await call("verify=%2Fapi%2Fv1%2Fauth%2Femail%2Fverify%2Fx&next=%2Fcustomer%2Fprofile");
    expect(response.headers.get("location")).toBe(
      "https://gce.example/auth/confirm?verify=%2Fapi%2Fv1%2Fauth%2Femail%2Fverify%2Fx&next=%2Fcustomer%2Fprofile",
    );
  });

  it("tells holders of an old Supabase link to sign in again", async () => {
    for (const query of ["code=c&next=%2Fcustomer%2Fprofile", "", "error_code=otp_expired"]) {
      expect((await call(query)).headers.get("location")).toBe("https://gce.example/auth/v1/login?error=link_expired");
    }
  });
});
