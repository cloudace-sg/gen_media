import React, { useState } from "react"
import { useAuth } from "../../contexts/auth-context"
import { Chrome, Loader2, AlertCircle } from "lucide-react"

export default function SignInButton() {
  const { signInWithGoogle, googleError } = useAuth()
  const [isLoading, setIsLoading] = useState(false)

  const handleGoogleSignIn = async () => {
    setIsLoading(true)
    try {
      await signInWithGoogle()
      // signInWithRedirect navigates away — setIsLoading won't run until redirect returns
    } catch (error) {
      console.error("Google sign-in error:", error)
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleGoogleSignIn}
        className="w-full bg-white hover:bg-gray-50 text-gray-900 border border-gray-300 rounded-md py-6 flex items-center justify-center gap-2"
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Redirecting to Google...
          </>
        ) : (
          <>
            <Chrome className="h-4 w-4" />
            Sign in with Google
          </>
        )}
      </button>
      {googleError && (
        <div className="flex items-start gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-md p-3">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{googleError}</span>
        </div>
      )}
    </div>
  )
}
