import { describe, expect, it } from "vitest";

import { GCE_ROLES } from "../auth/roles";
import { buildHtaccess } from "./htaccess";
import { landingPath, resolveInternalPath } from "./paths";

const text = buildHtaccess(["showroom", "vehicles"]);

describe("buildHtaccess (src/proxy.ts parity for the static build)", () => {
  it("sends each signed-in role from / to its landing page", () => {
    for (const role of GCE_ROLES) expect(text).toContain(`RewriteRule ^$ ${landingPath(role)}/ [R=302,L]`);
  });

  it("marks the 404 page no-store, so the CDN never serves one user's 404 instead of another's redirect", () => {
    expect(text).toContain('<Files "404.html">\n  Header always set Cache-Control "no-store"\n</Files>');
  });

  it("maps segment files before the auth/ exclusion, so login and reset pages get their page data", () => {
    expect(text.indexOf("(__next\\.")).toBeLessThan(text.indexOf("RewriteRule ^(_next|auth|template|unauthorized)"));
  });

  it("serves role-prefixed paths from the shared folders, like resolveInternalPath", () => {
    expect(text).toContain("RewriteRule ^ceo/dashboard/(.*)$ dashboard/$1 [L]");
    expect(text).toContain("RewriteRule ^ceo/recommendations(.*)$ staff-recommendations$1 [L]");
    expect(text).toContain("RewriteRule ^customer/inquiries(/.*)?$ my-inquiries$1 [L]");
    expect(text).toContain("RewriteRule ^customer/profile/$ my-profile/ [L]");
  });

  it("maps [id] segments to the placeholder unless the folder really exists (e.g. vehicles/new)", () => {
    expect(text).toContain(
      "RewriteCond %{REQUEST_FILENAME} !-d\nRewriteRule ^vehicles/(?!_/)[^/]+/(.*)$ vehicles/_/$1 [L]",
    );
  });

  it("sends signed-out visitors of any page but / to login, and leaves auth/template/_next alone", () => {
    expect(text).toContain("RewriteRule ^(.+)$ /auth/v1/login/ [R=302,L]");
    expect(text).toContain("RewriteRule ^(_next|auth|template|unauthorized)(/|$) - [L]");
  });

  it("keeps every regex backslash and runs redirects on the browser's own request only", () => {
    expect(text).toContain(String.raw`RewriteCond %{REQUEST_URI} !\.[A-Za-z0-9]+$`);
    expect(text).toContain(String.raw`RewriteCond %{HTTP_COOKIE} (^|;\s*)gce-role=ceo(;|$)`);
    expect(text).toContain(String.raw`RewriteCond %2::$1 !^([a-z_]+)::\1$`);
    expect(text).toContain("^account_manager/");
    expect(text).toContain(String.raw`RewriteRule ^(.*/)?(__next\.[^/.]+(?:/[^/.]+)*)\.([^/]+\.txt)$ $1$2/$3 [L]`);
    // Every external redirect is guarded, so a rewritten path is never redirected again (no loops).
    const lines = text.split("\n");
    lines.forEach((line, i) => {
      if (line.includes("[R=302") && !line.startsWith("RewriteRule ^auth/v1")) {
        expect(lines.slice(Math.max(0, i - 3), i)).toContain("RewriteCond %{ENV:REDIRECT_STATUS} ^$");
      }
    });
  });
});

describe("supplier portal routing (notes Part 1)", () => {
  it("lands a supplier on /supplier/portal and serves only the portal export folder", () => {
    expect(landingPath("supplier")).toBe("/supplier/portal");
    expect(resolveInternalPath("supplier", "portal/vehicles")).toBe("/portal/vehicles");
    expect(resolveInternalPath("supplier", "showroom")).toBe("/portal");
    expect(text).toContain("RewriteRule ^supplier/portal(/.*)?$ portal$1 [L]");
    expect(text).not.toContain("RewriteRule ^supplier/showroom");
  });
});
