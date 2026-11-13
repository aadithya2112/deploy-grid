import { expect, test } from "@playwright/test"

test("dashboard opens new-project flow and redirects to deployment logs", async ({
  page,
}) => {
  await page.goto("/dashboard")

  await expect(page.getByText("Your projects")).toBeVisible()
  await page
    .getByRole("link", { name: /new project/i })
    .first()
    .click()

  await expect(page).toHaveURL(/\/projects\/new$/)
  await page.getByLabel("GitHub URL").fill("https://github.com/acme/demo.git")
  await page.getByRole("button", { name: /create and deploy/i }).click()

  await expect(page).toHaveURL(
    /\/projects\/project-created-1\/deployments\/deployment-created-1$/
  )
  await expect(
    page.getByText("Refreshing while this deployment is still running.")
  ).toBeVisible()
  await expect(page.getByText("repository cloned")).toBeVisible()
})

test("deployment page renders ready logs for an existing deployment", async ({
  page,
}) => {
  await page.goto("/projects/project-ready/deployments/deployment-ready")

  await expect(page.getByText("deployment ready")).toBeVisible()
  await expect(page.getByText("abc123def456")).toBeVisible()
})

test("release management promotes a retained build and exposes production", async ({
  page,
}) => {
  await page.goto("/projects/12345678-1234-1234-1234-123456789012/manage")
  await expect(page.getByText("No production release yet")).toBeVisible()
  await expect(
    page.getByRole("combobox", { name: "Environment", exact: true })
  ).toBeVisible()
  await page.getByRole("button", { name: "Promote", exact: true }).click()
  await expect(page.getByRole("status")).toHaveText(
    "Production release updated"
  )
  await expect(
    page.getByRole("link", { name: "Open production site" })
  ).toHaveAttribute("href", "https://production.example.com")
  await expect(
    page.getByRole("button", { name: "Promote", exact: true })
  ).toBeDisabled()
})
