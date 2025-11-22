import { auth } from "@/auth"
import { NextResponse } from "next/server"

export default auth((req) => {
  if (!req.auth) {
    const signInUrl = new URL("/auth/signin", req.url)
    signInUrl.searchParams.set("callbackUrl", req.url)
    return NextResponse.redirect(signInUrl)
  }
  return NextResponse.next()
})

export const config = {
  matcher: [
    // Protect all routes except auth routes, static files, API auth, and test API
    "/((?!auth|api/auth|api/test|_next/static|_next/image|favicon.ico).*)",
  ],
}
