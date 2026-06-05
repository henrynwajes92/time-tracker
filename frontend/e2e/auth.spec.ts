import { test, expect } from "@playwright/test";
import { uniqueEmail } from "./helpers";

test.describe("Authentication", () => {
  test("register → login → see dashboard", async ({ page }) => {
    const email = uniqueEmail("register");
    const password = "testpassword123";

    // Register
    await page.goto("/register");
    await page.getByLabel("Name").fill("E2E User");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: /register/i }).click();
    await page.waitForURL("**/login**");

    // Login
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL("**/dashboard");

    // Dashboard should load
    await expect(page.getByText("Dashboard")).toBeVisible();
    await expect(page.getByText("Today")).toBeVisible();
    await expect(page.getByText("This week")).toBeVisible();
  });

  test("unauthenticated access to dashboard redirects to login", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL("**/login**");
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
  });

  test("wrong password shows error", async ({ page }) => {
    const email = uniqueEmail("wrongpass");
    // Register first
    await page.goto("/register");
    await page.getByLabel("Name").fill("Wrong Pass User");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("correctpassword");
    await page.getByRole("button", { name: /register/i }).click();
    await page.waitForURL("**/login**");

    // Try wrong password
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("wrongpassword");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByText(/invalid email or password/i)).toBeVisible();
  });
});
