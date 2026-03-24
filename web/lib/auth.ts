import "server-only"

import { auth as clerkAuth } from "@clerk/nextjs/server"

import { getE2ETestUserId, isE2ETestMode } from "@/lib/test-mode"

export interface AppAuthState {
  userId: string | null
}

export async function getAuth(): Promise<AppAuthState> {
  if (isE2ETestMode()) {
    return {
      userId: getE2ETestUserId(),
    }
  }

  const { userId } = await clerkAuth()

  return { userId }
}
