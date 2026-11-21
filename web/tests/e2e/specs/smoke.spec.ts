import { expect, test } from "@playwright/test"

test("workspace navigation, search and theme work on mobile and desktop", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" })
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto("/dashboard")
    const navigation = page.getByRole("navigation", {
      name: "Workspace navigation",
    })
    await expect(
      navigation.getByRole("link", { name: "Projects", exact: true })
    ).toHaveAttribute("aria-current", "page")
    await page
      .getByRole("searchbox", { name: "Find a project" })
      .fill("Ready App")
    await page.getByRole("button", { name: "Search", exact: true }).click()
    await expect(page).toHaveURL(/query=Ready(?:\+|%20)App/)
    const project = page.getByRole("link", {
      name: "Open Ready App",
      exact: true,
    })
    await expect(project).toBeVisible()
    await expect(
      page.getByRole("link", { name: "Open Managed App", exact: true })
    ).toHaveCount(0)
    await project.click()
    await expect(
      page.getByRole("heading", { name: "Recent deployments" })
    ).toBeVisible()
    await navigation
      .getByRole("link", { name: "Configuration", exact: true })
      .click()
    await expect(page).toHaveURL(/#configuration$/)
    await expect(
      page.getByRole("heading", { name: "Build settings" })
    ).toBeVisible()
    const sizing = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }))
    expect(sizing.content).toBeLessThanOrEqual(sizing.viewport)
  }
  await page.getByRole("button", { name: "Toggle color theme" }).click()
  await expect(page.locator("html")).toHaveClass(/dark/)
  await page.getByRole("button", { name: "Toggle color theme" }).click()
  await expect(page.locator("html")).not.toHaveClass(/dark/)
})

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

test("project page supports direct site visit, settings edits, env vars, and custom branch deploys", async ({
  page,
}) => {
  await page.goto("/projects/project-ready")

  await expect(
    page.getByRole("link", { name: "Visit site", exact: true })
  ).toHaveAttribute("href", "https://preview.example.com/deployment-ready")

  await page.getByRole("button", { name: "Edit", exact: true }).click()
  await page.getByLabel("Build command").fill("bun run build")
  await page.getByRole("button", { name: "Save settings" }).click()
  await expect(page.getByRole("status")).toContainText("Build settings updated")
  await expect(page.getByText("bun run build")).toBeVisible()

  await page.getByRole("button", { name: "Add variable" }).click()
  await page.getByLabel("Key").fill("VITE_PUBLIC_MODE")
  await page.getByLabel("Value").fill("staging-1234")
  await page.getByRole("button", { name: "Save variable" }).click()
  await expect(page.getByRole("status")).toContainText("Saved VITE_PUBLIC_MODE")
  await expect(
    page.getByText("VITE_PUBLIC_MODE", { exact: true })
  ).toBeVisible()

  await page.getByRole("button", { name: "Delete VITE_PUBLIC_MODE" }).click()
  await expect(page.getByRole("status")).toContainText(
    "Deleted VITE_PUBLIC_MODE"
  )

  await page.getByRole("button", { name: "Deploy ref" }).click()
  await page.getByLabel("Branch, tag, or commit SHA").fill("release/v2")
  await page.getByRole("button", { name: "Start deployment" }).click()
  await expect(page).toHaveURL(/\/projects\/project-ready\/deployments\/deployment-created-/)
  await expect(page.getByText("release/v2").first()).toBeVisible()
})

test("release management promotes a retained build and exposes production", async ({
  page,
}) => {
  test.skip(
    process.env.STATIC_PLATFORM_ENABLED !== "true",
    "Release controls are opt-in"
  )
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

test("legacy dashboard hides and blocks release management before backend cutover", async ({
  page,
}) => {
  test.skip(
    process.env.STATIC_PLATFORM_ENABLED === "true",
    "Legacy rollout mode"
  )
  const project = "/projects/12345678-1234-1234-1234-123456789012"
  await page.goto(project)
  await expect(
    page.getByRole("button", { name: "Redeploy latest" })
  ).toBeVisible()
  await expect(page.getByRole("link", { name: "Manage releases" })).toHaveCount(
    0
  )
  expect((await page.goto(`${project}/manage`))?.status()).toBe(404)
  for (const route of ["connect", "callback"]) {
    expect(
      (
        await page.request.get(
          `/api/github/${route}?projectId=${project.split("/").at(-1)}`
        )
      ).status()
    ).toBe(404)
  }
})
