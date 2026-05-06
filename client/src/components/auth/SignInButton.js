import React, { useState } from "react"
import { useAuth } from "../../contexts/auth-context"
import { Chrome, Loader2 } from "lucide-react"

export default function SignInButton() {
  const { signInWithGoogle } = useAuth()
  const [isLoading, setIsLoading] = useState(false)

  const handleGoogleSignIn = async () => {
    setIsLoading(true)
    try {
      await signInWithGoogle()
    } catch (error) {
      console.error("Google sign-in error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <button
      onClick={handleGoogleSignIn}
      className="w-full bg-white hover:bg-gray-50 text-gray-900 border border-gray-300 rounded-md py-6 flex items-center justify-center gap-2"
      disabled={isLoading}
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Signing in...
        </>
      ) : (
        <>
          <Chrome className="h-4 w-4" />
          Sign in with Google
        </>
      )}
    </button>
  )
}
