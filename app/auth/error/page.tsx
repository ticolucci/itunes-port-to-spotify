import Link from "next/link"

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md text-center">
        <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
        <p className="text-gray-600 mb-6">
          Your email is not authorized to access this application.
        </p>
        <Link
          href="/auth/signin"
          className="text-blue-500 hover:text-blue-600 underline"
        >
          Try again with a different account
        </Link>
      </div>
    </div>
  )
}
