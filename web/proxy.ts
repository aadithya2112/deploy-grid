import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

const isProtectedRoute = createRouteMatcher(["/dashboard(.*)", "/projects(.*)"])
const isE2ETestMode = process.env.E2E_TEST_MODE === "1"

const appProxy = isE2ETestMode
  ? () => NextResponse.next()
  : clerkMiddleware(async (auth, req) => {
      if (req.nextUrl.pathname === "/") {
        const { userId } = await auth()

        if (userId) {
          return NextResponse.redirect(new URL("/dashboard", req.url))
        }
      }

      if (isProtectedRoute(req)) {
        await auth.protect()
      }
    })

export default appProxy

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
}
