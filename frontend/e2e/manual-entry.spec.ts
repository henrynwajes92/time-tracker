import { test, expect } from "@playwright/test";
import { uniqueEmail, registerViaApi, loginPage } from "./helpers";

const API_URL = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:8081";

test.describe("Manual time entry", () => {
  test("log manual entry → appears in list", async ({ page }) => {
    const email = uniqueEmail("manual");
    const password = "password123";

    const user = await registerViaApi("Manual User", email, password);
    const token = user.accessToken;

    // Create project + task
    const projectRes = await fetch(`${API_URL}/api/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: "Manual Project" }),
    });
    const project = await projectRes.json();

    await fetch(`${API_URL}/api/projects/${project.id}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: "Manual Task" }),
    });

    await loginPage(page, email, password);
    await page.goto("/entries");

    // Open manual entry form
    await page.getByRole("button", { name: /log time manually/i }).click();

    // Fill form
    await page.getByLabel("Project").selectOption({ label: "Manual Project" });
    await page.getByLabel("Task").selectOption({ label: "Manual Task" });
    await page.getByLabel("Description").fill("Manual E2E entry");

    // Submit
    await page.getByRole("button", { name: /save entry/i }).click();

    // Entry appears in table
    await expect(page.getByText("Manual E2E entry")).toBeVisible();
  });
});
