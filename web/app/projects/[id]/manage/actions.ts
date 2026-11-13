"use server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { getAuth } from "@/lib/auth"
import { ApiRequestError, requestApi } from "@/lib/api"

export async function manageProjectAction(data: FormData) {
  const { userId } = await getAuth()
  if (!userId) redirect("/sign-in")
  const projectId = String(data.get("projectId") ?? "")
  if (!/^[0-9a-f-]{36}$/.test(projectId)) throw new Error("Invalid project")
  const operation = String(data.get("operation"))
  const text = (key: string) => String(data.get(key) ?? "").trim()
  const base = `/projects/${projectId}`
  let notice = "Saved"
  try {
    if (operation === "promote") {
      await requestApi(`${base}/promote`, {
        method: "POST",
        clerkUserId: userId,
        body: { deploymentId: text("deploymentId") },
      })
      notice = "Production release updated"
    } else if (operation === "cancel") {
      await requestApi(
        `/deployments/${encodeURIComponent(text("deploymentId"))}/cancel`,
        { method: "POST", clerkUserId: userId }
      )
      notice = "Build cancelled"
    } else if (operation === "deploy") {
      await requestApi(`${base}/deployments`, {
        method: "POST",
        clerkUserId: userId,
        body: {
          gitRef: text("gitRef") || undefined,
          environment: text("environment"),
        },
      })
      notice = "Deployment queued"
    } else if (operation === "settings") {
      await requestApi(base, {
        method: "PATCH",
        clerkUserId: userId,
        body: {
          defaultBranch: text("defaultBranch"),
          rootDirectory: text("rootDirectory") || null,
          installCommand: text("installCommand") || null,
          buildCommand: text("buildCommand") || null,
          outputDirectory: text("outputDirectory") || null,
        },
      })
    } else if (operation === "env") {
      await requestApi(`${base}/env-vars/${encodeURIComponent(text("key"))}`, {
        method: "PUT",
        clerkUserId: userId,
        body: {
          value: String(data.get("value") ?? ""),
          target: text("target"),
        },
      })
    } else if (operation === "delete-env") {
      await requestApi(
        `${base}/env-vars/${encodeURIComponent(text("key"))}?target=${encodeURIComponent(text("target"))}`,
        { method: "DELETE", clerkUserId: userId }
      )
    } else throw new Error("Unknown operation")
  } catch (error) {
    notice =
      error instanceof ApiRequestError
        ? error.message
        : "Unable to save this change"
  }
  revalidatePath(base)
  revalidatePath(`${base}/manage`)
  redirect(`${base}/manage?notice=${encodeURIComponent(notice)}`)
}
