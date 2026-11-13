import { cookies } from "next/headers"
import { getAuth } from "@/lib/auth"
import { getProject } from "@/lib/api"
export async function GET(request: Request) {
  const { userId } = await getAuth()
  if (!userId) return new Response("Unauthorized", { status: 401 })
  const projectId = new URL(request.url).searchParams.get("projectId") ?? ""
  if (!/^[0-9a-f-]{36}$/.test(projectId))
    return new Response("Invalid project", { status: 400 })
  await getProject(userId, projectId)
  const clientId = process.env.GITHUB_CLIENT_ID
  const base = process.env.WEB_BASE_URL
  if (!clientId || !base)
    return new Response("GitHub integration is not configured", { status: 503 })
  const state = crypto.randomUUID()
  const jar = await cookies()
  jar.set("dg-github-state", JSON.stringify({ state, userId, projectId }), {
    httpOnly: true,
    secure: base.startsWith("https:"),
    sameSite: "lax",
    maxAge: 600,
    path: "/api/github",
  })
  const url = new URL("https://github.com/login/oauth/authorize")
  url.searchParams.set("client_id", clientId)
  url.searchParams.set("redirect_uri", `${base}/api/github/callback`)
  url.searchParams.set("state", state)
  return Response.redirect(url)
}
