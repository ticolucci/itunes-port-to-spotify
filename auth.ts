import NextAuth from "next-auth"
import Google from "next-auth/providers/google"

const allowedEmail = process.env.ALLOWED_EMAIL

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      // Only allow the configured email
      if (!allowedEmail) {
        console.error("ALLOWED_EMAIL not configured")
        return false
      }
      return user.email === allowedEmail
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
})
