import Link from "next/link"
import { redirect } from "next/navigation"
import { auth } from "@clerk/nextjs/server"

import { Button } from "@/components/ui/button"

export default async function LandingPage() {
  const { userId } = await auth()

  if (userId) {
    redirect("/dashboard")
  }

  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <div className="text-center">
        <h1 className="font-heading text-4xl font-semibold tracking-tight md:text-5xl">
          Deploy Grid
        </h1>
        <p className="mt-3 text-sm text-muted-foreground md:text-base">
          Ship and monitor deployments from one clean dashboard.
        </p>
        <Button asChild className="mt-6">
          <Link href="/sign-in">Sign in</Link>
        </Button>
      </div>
    </main>
  )
}
