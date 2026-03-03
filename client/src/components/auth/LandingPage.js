import React, { useState } from "react"
import SignInButton from "./SignInButton"
import EmailSignIn from "./EmailSignIn"
import { Mail } from "lucide-react"

export default function LandingPage() {
  const [showEmailSignIn, setShowEmailSignIn] = useState(false)

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          <div className="mb-6 flex justify-center">
            <img 
              src="/images/Logo.svg" 
              alt="Cloud Ace" 
              className="h-16 w-auto"
            />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Gen AI Media Studio</h1>
          <p className="mt-2 text-gray-600">Sign in to your account</p>
        </div>

        {!showEmailSignIn ? (
          <div className="space-y-4">
            <SignInButton />
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-gray-50 text-gray-500">Or</span>
              </div>
            </div>

            <button
              onClick={() => setShowEmailSignIn(true)}
              className="w-full border border-gray-300 rounded-md py-6 flex items-center justify-center gap-2 text-gray-900 hover:bg-gray-50"
            >
              <Mail className="h-4 w-4" />
              Sign in with Email
            </button>
          </div>
        ) : (
          <EmailSignIn onBack={() => setShowEmailSignIn(false)} />
        )}
      </div>
    </div>
  )
}
