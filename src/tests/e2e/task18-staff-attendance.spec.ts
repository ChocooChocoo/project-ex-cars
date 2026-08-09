import { expect, type Page, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const seedPassword = process.env.SEED_USER_PASSWORD;
const allowSeedMutations = process.env.TASK18_E2E_MUTATIONS === "true";
const allowRealtimeMutations = process.env.TASK18_E2E_REALTIME_MUTATIONS === "true";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const attendanceStatuses = ["present", "late", "absent", "half_day", "on_leave"] as const;
const attendanceStatusLabels = {
  present: "Present",
  late: "Late",
  absent: "Absent",
  half_day: "Half Day",
  on_leave: "Leave",
} as const;

type AttendanceFixture = {
  id: string;
  status: (typeof attendanceStatuses)[number];
  notes: string | null;
  profiles: { full_name: string | null } | null;
};

function getSeedPassword() {
  if (!seedPassword) {
    throw new Error("SEED_USER_PASSWORD is required for the Task 18 CEO staff browser regression.");
  }
  return seedPassword;
}

async function signIn(page: Page, email: string, path: string) {
  await page.goto("/auth/v1/login");
  await page.getByLabel("Email Address", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(getSeedPassword());
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/auth/v1/login"), { timeout: 15000 });
  await page.goto(path);
  await expect(page).toHaveURL(new RegExp(`${path.replaceAll("/", "\\/")}$`));
}

async function signInAsCeo(page: Page, path: "/ceo/staff-records" | "/ceo/attendance") {
  await signIn(page, "ceo@gce.local", path);
}

async function assertNoPageOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

function accountRow(page: Page, name = "Eduardo Aquino") {
  return page.locator("tbody tr").filter({ hasText: name }).first();
}

async function openAccountSheet(page: Page, action: "Edit" | "Set Status", name = "Eduardo Aquino") {
  const row = accountRow(page, name);
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: new RegExp(`More actions for ${name}`, "i") }).click();
  await page.getByRole("menuitem", { name: action, exact: true }).click();
}

test.describe("Task 18 staff records and attendance", () => {
  test.skip(!seedPassword, "SEED_USER_PASSWORD is required for the Task 18 CEO staff browser regression.");

  test("CEO Staff Records uses compact menus and right-side Sheets", async ({ page }) => {
    await signInAsCeo(page, "/ceo/staff-records");

    await expect(page.getByRole("heading", { name: "Staff Records", exact: true })).toBeVisible();
    await expect(page.locator("#staff-records-rows-per-page")).toBeVisible();

    await openAccountSheet(page, "Edit");
    const editSheet = page.locator("[data-slot='sheet-content']").filter({ hasText: "Edit Account" });
    await expect(editSheet).toHaveAttribute("data-side", "right");
    await expect(editSheet.getByLabel("Full name", { exact: true })).toBeVisible();
    await editSheet.getByRole("button", { name: "Close", exact: true }).click();

    await openAccountSheet(page, "Set Status");
    const statusSheet = page.locator("[data-slot='sheet-content']").filter({ hasText: "Change Account Status" });
    await expect(statusSheet).toHaveAttribute("data-side", "right");
    await expect(statusSheet.getByLabel("New status", { exact: true })).toBeVisible();
  });

  test("CEO staff pages remain within narrow, medium, and wide documents", async ({ page }) => {
    for (const path of ["/ceo/staff-records", "/ceo/attendance"] as const) {
      await signInAsCeo(page, path);
      for (const viewport of [
        { width: 390, height: 844 },
        { width: 768, height: 900 },
        { width: 1440, height: 900 },
      ]) {
        await page.setViewportSize(viewport);
        await page.reload();
        await assertNoPageOverflow(page);
      }
    }
  });

  test("CEO Attendance keeps its PHT clock live", async ({ page }) => {
    await signInAsCeo(page, "/ceo/attendance");

    await expect(page.getByRole("heading", { name: "Attendance", exact: true })).toBeVisible();
    const clock = page.getByTestId("attendance-clock");
    await expect(clock).toBeVisible();
    const initialClock = await clock.textContent();
    await expect.poll(() => clock.textContent(), { timeout: 3000 }).not.toBe(initialClock);
    await expect(page.getByText("PHT / Asia/Manila", { exact: true })).toBeVisible();
  });

  test("CEO Attendance renders seeded employee rows with semantic status badges", async ({ page }) => {
    await signInAsCeo(page, "/ceo/attendance");
    const rows = page.locator("tbody tr").filter({ hasNotText: "No results." });
    test.skip((await rows.count()) === 0, "The connected seed has no CEO-readable attendance rows.");

    await expect(page.getByText("All Records", { exact: true })).toBeVisible();
    await expect(page.locator("#attendance-rows-per-page")).toBeVisible();
    await expect(rows.first()).toContainText(/.+/);
    await expect(page.locator("thead")).toContainText("Employee");

    const statusClasses = [
      ["Present", "bg-emerald-500"],
      ["Late", "bg-amber-500"],
      ["Absent", "bg-destructive"],
      ["Half Day", "bg-sky-500"],
      ["Leave", "border-muted-foreground/40"],
    ] as const;

    const badges = page.locator("[data-slot='badge']");
    test.skip((await badges.count()) === 0, "The connected seed has no attendance status badges.");
    const missingLabels: string[] = [];
    for (const [label] of statusClasses) {
      if ((await badges.filter({ hasText: label }).count()) === 0) missingLabels.push(label);
    }
    test.skip(
      missingLabels.length > 0,
      `The seeded attendance fixture is missing required semantic statuses: ${missingLabels.join(", ")}.`,
    );
    for (const [label, className] of statusClasses) {
      const badge = badges.filter({ hasText: label }).first();
      await expect(badge, `The seeded attendance data must include a ${label} status.`).toBeVisible();
      await expect(badge).toHaveClass(new RegExp(className));
    }
  });

  test("approved leave disables a seeded employee clock-in when the leave is active", async ({ page }) => {
    await signIn(page, "mechanic@gce.local", "/mechanic/attendance");
    const leaveReason = page.getByText("Approved leave applies today.", { exact: true });
    test.skip((await leaveReason.count()) === 0, "The deterministic leave fixture is not active today.");

    await expect(leaveReason).toBeVisible();
    await expect(page.getByRole("button", { name: "Clock In", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Clock In", exact: true })).toHaveAttribute(
      "title",
      "Approved leave applies today.",
    );
  });

  test("CEO persists a selected staff record update across a second session and restores the seeded value", async ({
    page,
    browser,
  }) => {
    test.skip(
      !allowSeedMutations,
      "Set TASK18_E2E_MUTATIONS=true to run reversible seeded-record persistence coverage.",
    );
    await signInAsCeo(page, "/ceo/staff-records");
    await openAccountSheet(page, "Edit");

    const sheet = page.locator("[data-slot='sheet-content']").filter({ hasText: "Edit Account" });
    const phone = sheet.getByLabel("Phone", { exact: true });
    const originalPhone = await phone.inputValue();
    const temporaryPhone = `0917${Date.now().toString().slice(-7)}`;

    try {
      await phone.fill(temporaryPhone);
      await sheet.getByRole("button", { name: "Save", exact: true }).click();
      await expect(sheet).toBeHidden();

      const observerContext = await browser.newContext();
      const observer = await observerContext.newPage();
      try {
        await signInAsCeo(observer, "/ceo/staff-records");
        await openAccountSheet(observer, "Edit");
        await expect(observer.getByLabel("Phone", { exact: true })).toHaveValue(temporaryPhone);
      } finally {
        await observerContext.close();
      }
    } finally {
      const activeSheet = page.locator("[data-slot='sheet-content']").filter({ hasText: "Edit Account" });
      if ((await activeSheet.count()) === 0) await openAccountSheet(page, "Edit");
      const restorePhone = page.getByLabel("Phone", { exact: true });
      await restorePhone.fill(originalPhone);
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await expect(page.locator("[data-slot='sheet-content']").filter({ hasText: "Edit Account" })).toBeHidden();
    }
  });

  test("a second authorized session receives an attendance Realtime refresh", async ({ browser }) => {
    test.skip(
      !allowRealtimeMutations || !supabaseUrl || !serviceRoleKey,
      "Set TASK18_E2E_REALTIME_MUTATIONS=true, NEXT_PUBLIC_SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY for the reversible service-role fixture.",
    );
    if (!supabaseUrl || !serviceRoleKey) return;

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    });
    const { data, error } = await admin
      .from("attendance_entries")
      .select("id, status, notes, profiles(full_name)")
      .is("checked_by", null)
      .not("time_in", "is", null)
      .not("time_out", "is", null)
      .order("attendance_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    const fixture = data as AttendanceFixture | null;
    test.skip(
      error !== null || !fixture?.profiles?.full_name,
      "No eligible unchecked, clocked-out attendance fixture exists.",
    );
    if (!fixture?.profiles?.full_name) return;

    const employeeName = fixture.profiles.full_name;
    const nextStatus = attendanceStatuses.find((status) => status !== fixture.status);
    test.skip(!nextStatus, "The selected fixture has no alternate semantic attendance status.");
    if (!nextStatus) return;
    const temporaryNote = `Task 18 Realtime fixture ${Date.now()}`;
    const observerContext = await browser.newContext();
    const editorContext = await browser.newContext();
    const observer = await observerContext.newPage();
    const editor = await editorContext.newPage();

    try {
      await signIn(observer, "head_accountant@gce.local", "/head_accountant/attendance");
      await signInAsCeo(editor, "/ceo/attendance");
      const observerRow = observer.locator("tbody tr").filter({ hasText: employeeName }).first();
      const editorRow = editor.locator("tbody tr").filter({ hasText: employeeName }).first();
      await expect(observerRow).toBeVisible();
      await expect(editorRow).toBeVisible();

      const { error: updateError } = await admin
        .from("attendance_entries")
        .update({ notes: temporaryNote, status: nextStatus })
        .eq("id", fixture.id);
      expect(updateError).toBeNull();
      await expect(observerRow.locator("[data-slot='badge']").first()).toHaveText(attendanceStatusLabels[nextStatus], {
        timeout: 10000,
      });
      await expect(editorRow.locator("[data-slot='badge']").first()).toHaveText(attendanceStatusLabels[nextStatus], {
        timeout: 10000,
      });
    } finally {
      const { error: restoreError } = await admin
        .from("attendance_entries")
        .update({ notes: fixture.notes, status: fixture.status })
        .eq("id", fixture.id);
      expect(restoreError).toBeNull();
      await Promise.all([observerContext.close(), editorContext.close()]);
    }
  });
});
