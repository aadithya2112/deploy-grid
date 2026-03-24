import { expect, test } from "@playwright/test"

test("dashboard opens new-project flow and redirects to deployment logs", async ({
  page,
}) => {
  await page.goto("/dashboard")

  await expect(page.getByText("Your projects")).toBeVisible()
  await page.getByRole("link", { name: /new project/i }).first().click()

  await expect(page).toHaveURL(/\/projects\/new$/)
  await page.getByLabel("GitHub URL").fill("https://github.com/acme/demo.git")
  await page.getByRole("button", { name: /create and deploy/i }).click()

  await expect(page).toHaveURL(/\/projects\/project-created-1\/deployments\/deployment-created-1$/)
  await expect(
    page.getByText("Refreshing while this deployment is still running.")
  ).toBeVisible()
  await expect(page.getByText("repository cloned")).toBeVisible()
})

test("deployment page renders ready logs for an existing deployment", async ({ page }) => {
  await page.goto("/projects/project-ready/deployments/deployment-ready")

  await expect(page.getByText("deployment ready")).toBeVisible()
  await expect(page.getByText("abc123def456")).toBeVisible()
})
