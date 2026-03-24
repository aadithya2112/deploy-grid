import { NextResponse } from "next/server"

import { getAuth } from "@/lib/auth"
import { ApiRequestError, listDeploymentLogs } from "@/lib/api"

export async function GET(
  request: Request,
  context: { params: Promise<{ deploymentId: string }> }
) {
  const { userId } = await getAuth()

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { deploymentId } = await context.params
  const url = new URL(request.url)
  const limitValue = url.searchParams.get("limit")
  const afterSequenceValue = url.searchParams.get("afterSequence")

  const limit =
    typeof limitValue === "string" && limitValue.length > 0
      ? Number(limitValue)
      : undefined
  const afterSequence =
    typeof afterSequenceValue === "string" && afterSequenceValue.length > 0
      ? Number(afterSequenceValue)
      : undefined

  try {
    const logs = await listDeploymentLogs(userId, deploymentId, {
      limit: Number.isFinite(limit) ? limit : undefined,
      afterSequence: Number.isFinite(afterSequence) ? afterSequence : undefined,
    })

    return NextResponse.json(logs)
  } catch (error) {
    if (error instanceof ApiRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    const message = error instanceof Error ? error.message : "Failed to load logs"

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
