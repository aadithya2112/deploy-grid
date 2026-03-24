import { NextResponse } from "next/server"

import { getAuth } from "@/lib/auth"
import { ApiRequestError, getDeployment } from "@/lib/api"

export async function GET(
  _request: Request,
  context: { params: Promise<{ deploymentId: string }> }
) {
  const { userId } = await getAuth()

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { deploymentId } = await context.params

  try {
    const deployment = await getDeployment(userId, deploymentId)
    return NextResponse.json(deployment)
  } catch (error) {
    if (error instanceof ApiRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    const message =
      error instanceof Error ? error.message : "Failed to load deployment"

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
