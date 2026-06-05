import { test, expect } from "@playwright/test";
import { uniqueEmail, registerViaApi, loginPage } from "./helpers";

const API_URL = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:8081";

test.describe("Live timer", () => {
  test("start timer → stop timer → entry appears in list", async ({ page }) => {
    const email = uniqueEmail("timer");
    const password = "password123";

    // Setup: register user and create project+task via API
    const user = await registerViaApi("Timer User", email, password);
    const token = user.accessToken;

    const projectRes = await fetch(`${API_URL}/api/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: "E2E Project" }),
    });
    const project = await projectRes.json();

    const taskRes = await fetch(`${API_URL}/api/projects/${project.id}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: "E2E Task" }),
    });
    await taskRes.json();

    // Login
    await loginPage(page, email, password);
    await page.goto("/timer");

    // Select project
    await page.getByLabel("Project").selectOption({ label: "E2E Project" });
    await page.getByLabel("Task").selectOption({ label: "E2E Task" });

    // Start timer
    await page.getByRole("button", { name: /start timer/i }).click();
    await expect(page.getByText(/timer running/i)).toBeVisible();

    // Wait a moment then stop
    await page.waitForTimeout(1500);
    await page.getByRole("button", { name: /stop timer/i }).click();

    // Should return to idle state
    await expect(page.getByRole("button", { name: /start timer/i })).toBeVisible();

    // Verify entry appears in entries list
    await page.goto("/entries");
    await expect(page.getByText("E2E")).toBeVisible();
  });
});
