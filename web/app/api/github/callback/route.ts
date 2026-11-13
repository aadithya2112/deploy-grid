import { cookies } from "next/headers"
import { getAuth } from "@/lib/auth"
import { ApiRequestError, requestApi } from "@/lib/api"
export async function GET(request: Request) {
  const { userId } = await getAuth()
  const jar = await cookies()
  const saved = jar.get("dg-github-state")?.value
  jar.delete({ name: "dg-github-state", path: "/api/github" })
  const url = new URL(request.url)
  if (!userId || !saved)
    return new Response("Authorization expired", { status: 401 })
  let state: { state: string; userId: string; projectId: string }
  try {
    state = JSON.parse(saved)
  } catch {
    return new Response("Invalid state", { status: 400 })
  }
  if (
    state.userId !== userId ||
    state.state !== url.searchParams.get("state") ||
    !url.searchParams.get("code")
  )
    return new Response("Invalid authorization", { status: 400 })
  let notice = "GitHub connected"
  try {
    await requestApi(`/projects/${state.projectId}/github`, {
      method: "POST",
      clerkUserId: userId,
      body: { code: url.searchParams.get("code") },
    })
  } catch (error) {
    notice =
      error instanceof ApiRequestError
        ? error.message
        : "Unable to connect GitHub"
  }
  return Response.redirect(
    new URL(
      `/projects/${state.projectId}/manage?notice=${encodeURIComponent(notice)}`,
      process.env.WEB_BASE_URL!
    )
  )
}
