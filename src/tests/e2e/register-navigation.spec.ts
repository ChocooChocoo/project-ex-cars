import { expect, test } from "@playwright/test";

test("Register on the v1 login page opens customer registration", async ({ page }) => {
  await page.goto("/auth/v1/login/");

  const register = page.getByRole("link", { name: "Register", exact: true });
  await expect(register).toHaveAttribute("href", /^\/auth\/v1\/register\/?$/);
  await register.click();

  await expect(page).toHaveURL(/\/auth\/v1\/register\/?$/);
  await expect(page.getByLabel("Email Address", { exact: true })).toBeVisible();
});
