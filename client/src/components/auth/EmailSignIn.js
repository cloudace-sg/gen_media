import React, { useState } from "react"
import { useAuth } from "../../contexts/auth-context"
import { Mail, Loader2, CheckCircle, AlertCircle, ArrowLeft } from "lucide-react"
import { checkUserExists } from "../../services/api"

export default function EmailSignIn({ onBack }) {
  const { signInWithEmail, emailLinkError, emailLinkSent } = useAuth()
  const [email, setEmail] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [validationError, setValidationError] = useState(null)
  const isProd = process.env.NODE_ENV === 'production'

  // Check if email is allowed: in production, check Firebase Auth; in dev, check localStorage
  const isAllowedDomain = async (email) => {
    if (!email) return false
    
    // In production, check Firebase Auth
    if (isProd) {
      try {
        const result = await checkUserExists(email)
        if (!result.exists) {
          return false
        }
        if (result.disabled) {
          return false
        }
        return true
      } catch (error) {
        console.error('Error checking user:', error)
        return false
      }
    }
    
    // In development, check local users list
    try {
      const localUsers = JSON.parse(localStorage.getItem('localUsers') || '[]')
      const existsInLocal = localUsers.some(user => 
        user.email.toLowerCase() === email.toLowerCase() && !user.disabled
      )
      if (existsInLocal) return true
    } catch (error) {
      console.error('Error checking local users:', error)
    }
    
    // Fallback: check allowed domains (for development/testing)
    const allowedDomains = ["cloud-ace.com", "anotherdomain.com"]
    const allowedEmails = [
      "admin@cloud-ace.com",
      "user@anotherdomain.com",
      "minhngo@cloud-ace.com",
    ]
    
    const domain = email.split("@")[1]?.toLowerCase()
    const emailLower = email.toLowerCase()
    return allowedDomains.some((d) => domain === d) || allowedEmails.includes(emailLower)
  }

  const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return re.test(email)
  }

  const handleSignIn = async () => {
    // Reset errors
    setValidationError(null)

    // Validate email
    if (!email.trim()) {
      setValidationError("Please enter your email address")
      return
    }

    if (!validateEmail(email)) {
      setValidationError("Please enter a valid email address")
      return
    }

    setIsSubmitting(true)
    try {
      const allowed = await isAllowedDomain(email)
      if (!allowed) {
        setValidationError(isProd 
          ? "This email is not registered. Please contact an administrator to be added."
          : "Only emails from allowed domains and selected emails are allowed.")
        setIsSubmitting(false)
        return
      }
      
      await signInWithEmail(email)
    } catch (error) {
      console.error("Sign in error:", error)
      setValidationError(error.message || "Failed to sign in. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (emailLinkSent) {
    return (
      <div className="space-y-4">
        <div className="bg-green-50 border border-green-200 rounded-md p-4 flex items-start gap-3">
          <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
          <div className="text-green-800">
            Sign-in link sent! Please check your email ({email}) and click the link to sign in.
          </div>
        </div>
        <p className="text-sm text-gray-600">
          If you don't see the email, check your spam folder. The link will expire after 24 hours.
        </p>
        {onBack && (
          <button 
            onClick={onBack} 
            className="text-gray-700 hover:text-gray-900 flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to sign-in options
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {onBack && (
        <button
          onClick={onBack}
          className="mb-2 -ml-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md px-2 py-1 flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
      )}

      <div className="space-y-2">
        <label htmlFor="email" className="text-gray-700 block text-sm font-medium">
          Email Address
        </label>
        <input
          id="email"
          type="email"
          placeholder="your.email@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        {validationError && <p className="text-red-500 text-sm">{validationError}</p>}
      </div>

      {emailLinkError && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-start gap-3">
          <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
          <div className="text-red-800">{emailLinkError}</div>
        </div>
      )}

      <button
        onClick={handleSignIn}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-md py-6 flex items-center justify-center gap-2"
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Sending Link...
          </>
        ) : (
          <>
            <Mail className="h-4 w-4" />
            Sign in with Email
          </>
        )}
      </button>
      <p className="text-xs text-center text-gray-600">
        We'll send a sign-in link to your email.
        <br />
        No password required!
      </p>
    </div>
  )
}
