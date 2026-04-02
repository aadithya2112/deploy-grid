import { NextResponse } from "next/server"

import { ApiRequestError, getApiBaseUrlForUi, getHealth } from "@/lib/api"

export async function GET() {
  try {
    const health = await getHealth()

    return NextResponse.json({
      apiBaseUrl: getApiBaseUrlForUi(),
      health,
    })
  } catch (error) {
    if (error instanceof ApiRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    const message = error instanceof Error ? error.message : "Failed to load health"

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
