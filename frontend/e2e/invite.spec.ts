import { test, expect } from "@playwright/test";
import { uniqueEmail, registerViaApi, loginPage } from "./helpers";

const API_URL = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:8081";

test.describe("Invite flow", () => {
  test("admin generates invite link → member accepts → member can log in", async ({ page }) => {
    const adminEmail = uniqueEmail("admin");
    const memberEmail = uniqueEmail("member");
    const password = "password123";

    // Register admin
    const admin = await registerViaApi("Admin User", adminEmail, password);
    const adminToken = admin.accessToken;

    // Generate invite via API
    const inviteRes = await fetch(`${API_URL}/api/invites`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ email: memberEmail }),
    });
    const { token } = await inviteRes.json();

    // Accept invite in browser
    await page.goto(`/invite/${token}`);
    await expect(page.getByRole("heading", { name: /accept invite/i })).toBeVisible();

    await page.getByLabel("Name").fill("Member User");
    // Email should be pre-filled
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: /create account/i }).click();

    // Redirected to login
    await page.waitForURL("**/login**");

    // Member can log in
    await loginPage(page, memberEmail, password);
    await expect(page.getByText("Dashboard")).toBeVisible();

    // Member should NOT see Team link (MEMBER role)
    await expect(page.getByRole("link", { name: "Team" })).not.toBeVisible();
  });
});
