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
    // Protect all routes except auth routes, static files, and API auth
    "/((?!auth|api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
}
