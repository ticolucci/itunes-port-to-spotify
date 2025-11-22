import { auth } from "@/auth"
import { NextResponse } from "next/server"

export default auth((req) => {
  // Allow bypass for e2e tests using Vercel automation bypass secret
  const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
  const bypassHeader = req.headers.get("x-vercel-protection-bypass")

  if (bypassSecret && bypassHeader === bypassSecret) {
    return NextResponse.next()
  }

  if (!req.auth) {
    const signInUrl = new URL("/auth/signin", req.url)
    signInUrl.searchParams.set("callbackUrl", req.url)
    return NextResponse.redirect(signInUrl)
  }
  return NextResponse.next()
})

export const config = {
  matcher: [
    // Protect all routes except auth routes and static files
    "/((?!auth|api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
}
