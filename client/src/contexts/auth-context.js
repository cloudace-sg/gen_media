import React, { createContext, useContext, useEffect, useState } from "react"
import {
  onAuthStateChanged,
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
} from "firebase/auth"
import { auth, googleProvider } from "../lib/firebase"
import { checkUserExists } from "../services/api"
import { postSignIn } from "../services/api"

const AuthContext = createContext({
  user: null,
  userRole: null,
  loading: true,
  signInWithGoogle: async () => {},
  signInWithEmail: async () => {},
  completeEmailSignIn: async () => false,
  signOut: async () => {},
  emailLinkError: null,
  emailLinkSent: false,
})

export const useAuth = () => useContext(AuthContext)

// Configure allowed domains and emails (moved outside component to prevent re-creation)
const allowedDomains = ["cloud-ace.com", "anotherdomain.com"]
const allowedEmails = [
  "admin@cloud-ace.com",
  "user@anotherdomain.com",
  "minhngo@cloud-ace.com",
]

// Function to check if user exists in local users list
const checkLocalUser = (email) => {
  try {
    const localUsers = JSON.parse(localStorage.getItem('localUsers') || '[]')
    return localUsers.find(user => user.email.toLowerCase() === email.toLowerCase() && !user.disabled)
  } catch (error) {
    console.error('Error checking local users:', error)
    return null
  }
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isInitialized, setIsInitialized] = useState(false)
  const [emailLinkError, setEmailLinkError] = useState(null)
  const [emailLinkSent, setEmailLinkSent] = useState(false)
  const [forbiddenDomainError, setForbiddenDomainError] = useState(null)
  const [googleError, setGoogleError] = useState(null)
  const isProd = process.env.NODE_ENV === 'production'

  // Initialize Firebase auth on component mount
  useEffect(() => {
    // Check if auth is available
    if (!auth) {
      console.warn("Firebase auth is not initialized")
      setLoading(false)
      return () => {}
    }

    setIsInitialized(true)

    // Handle Google redirect result on page load (signInWithRedirect lands here)
    getRedirectResult(auth).catch((error) => {
      console.error("Google redirect sign-in error:", error)
      setGoogleError(error.message || "Google sign-in failed. Please try again.")
    })

    const updateUserRole = async (firebaseUser) => {
      if (!firebaseUser) {
        setUserRole(null)
        return
      }

      const email = firebaseUser.email || ""
      const domain = email.split("@")[1]?.toLowerCase()
      
      // In production, check Firebase Auth instead of domain whitelist
      if (isProd) {
        // Check if user exists in Firebase Auth (must have been created via /invite)
        try {
          const result = await checkUserExists(email)
          if (!result.exists) {
            // User doesn't exist in Firebase Auth - sign them out
            if (auth) {
              await firebaseSignOut(auth)
            }
            setUser(null)
            setUserRole(null)
            setForbiddenDomainError("You are not authorized to access this application. Please contact an administrator to be added.")
            setLoading(false)
            return
          }
          if (result.disabled) {
            // User is disabled - sign them out
            if (auth) {
              await firebaseSignOut(auth)
            }
            setUser(null)
            setUserRole(null)
            setForbiddenDomainError("Your account has been disabled. Please contact an administrator.")
            setLoading(false)
            return
          }
          // User exists and is enabled - get their role from Firebase custom claims
          try {
            const idTokenResult = await firebaseUser.getIdTokenResult()
            const role = idTokenResult.claims.role
            // Do not default to 'editor' in production if claims.role is absent
            setUserRole(role || null)
          } catch (error) {
            console.warn('Failed to get user role:', error)
            // Do not default to 'editor' in production
            setUserRole(null)
          }
          return
        } catch (error) {
          console.error('Error checking user existence:', error)
          // On error, allow through but log it
          try {
            const idTokenResult = await firebaseUser.getIdTokenResult()
            const role = idTokenResult.claims.role
            setUserRole(role || null)
          } catch (e) {
            console.warn('Failed to get user role:', e)
            setUserRole(null)
          }
          return
        }
      }
      
      // Development mode: check local users list first
      const localUser = checkLocalUser(email)
      
      if (localUser) {
        // User exists in local list and is not disabled, use their local role
        setUserRole(localUser.role)
      } else if (!allowedDomains.some((d) => domain === d) && !allowedEmails.includes(email.toLowerCase())) {
        // Not in local list and not in allowed domains/emails, sign out
        if (auth) {
          await firebaseSignOut(auth)
        }
        setUser(null)
        setUserRole(null)
        setForbiddenDomainError("You are not authorized to access this application. Please contact an administrator.")
        setLoading(false)
        return
      } else {
        // User is in allowed domains/emails but not in local list, use Firebase role
        try {
          const idTokenResult = await firebaseUser.getIdTokenResult()
          const role = idTokenResult.claims.role || 'editor'
          setUserRole(role)
        } catch (error) {
          console.warn('Failed to get user role:', error)
          setUserRole('editor') // Default to editor if can't get role
        }
      }
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // First update role; this may sign the user out
      await updateUserRole(firebaseUser)

      // If signed out during updateUserRole, stop here to avoid reintroducing a stale user
      const current = auth.currentUser
      if (!current) {
        setUser(null)
        setLoading(false)
        return
      }

      // Proceed with the current authenticated user
      setUser(current)
      setLoading(false)

      // Set a cookie for server-side auth checks
      document.cookie = "auth=true; path=/; max-age=86400" // 24 hours

      // In production, enforce invite-only by calling postSignIn endpoint
      // This will reject users without roles and sign them out
      if (isProd) {
        try {
          await postSignIn()
          // Force refresh token to pick up any new claims
          await current.getIdToken(true)
          // Update role again after token refresh
          await updateUserRole(current)
        } catch (error) {
          // Only sign out on explicit auth rejections — not on server restarts (5xx/network)
          const status = error.response?.status || error.status
          if (status === 401 || status === 403) {
            await firebaseSignOut(auth)
            setUser(null)
            setUserRole(null)
            setForbiddenDomainError("You are not authorized to access this application. Please contact an administrator.")
            setLoading(false)
            return
          }
          // 5xx or network error during deploy — keep user signed in, retry will happen on next navigation
          console.warn('postSignIn transient error (keeping session):', status, error.message)
        }
      }
    })

    // Listen for custom event when local users are updated (from UsersPage)
    const handleLocalUsersUpdate = async () => {
      // Get current user directly from auth to avoid stale closure
      const currentUser = auth.currentUser
      if (currentUser) {
        await updateUserRole(currentUser)
      }
    }
    window.addEventListener('localUsersUpdated', handleLocalUsersUpdate)
    
    // Also check periodically for localStorage changes (same-origin updates don't trigger storage event)
    const checkInterval = setInterval(async () => {
      const currentUser = auth.currentUser
      if (currentUser) {
        const localUser = checkLocalUser(currentUser.email)
        if (localUser) {
          // Check current role from state by reading it via a closure-safe method
          setUserRole(prevRole => {
            if (localUser.role !== prevRole) {
              return localUser.role
            }
            return prevRole
          })
        }
      }
    }, 2000) // Check every 2 seconds

    return () => {
      unsubscribe()
      window.removeEventListener('localUsersUpdated', handleLocalUsersUpdate)
      clearInterval(checkInterval)
    }
  }, [allowedDomains, allowedEmails])

  // Check for email sign-in links on page load
  useEffect(() => {
    if (!isInitialized || !auth) return

    const checkEmailLink = async () => {
      // Check if the URL contains a sign-in link
      if (auth && isSignInWithEmailLink(auth, window.location.href)) {
        // Get the email from localStorage (saved when sending the link)
        let email = localStorage.getItem("emailForSignIn")

        if (!email) {
          // If email is not found in localStorage, prompt the user
          email = window.prompt("Please provide your email for confirmation")
        }

        if (email) {
          try {
            // Complete the sign-in process
            await signInWithEmailLink(auth, email, window.location.href)

            // Clear the email from storage
            localStorage.removeItem("emailForSignIn")

            // Clear the URL to remove the sign-in link
            window.history.replaceState({}, document.title, window.location.pathname)
          } catch (error) {
            console.error("Error signing in with email link:", error)
            window.history.replaceState({}, document.title, window.location.pathname)
            localStorage.removeItem("emailForSignIn")
            const code = error?.code || ''
            if (code === 'auth/invalid-action-code' || code === 'auth/expired-action-code') {
              setEmailLinkError("This sign-in link has expired or already been used. Please request a new one.")
            } else if (code === 'auth/invalid-email') {
              setEmailLinkError("Email address doesn't match the sign-in link. Please use the same email you entered.")
            } else {
              setEmailLinkError("Failed to sign in with email link. Please try again.")
            }
          }
        }
      }
    }

    checkEmailLink()
  }, [isInitialized])

  // Auto-dismiss forbidden domain error after 5 seconds
  useEffect(() => {
    if (forbiddenDomainError) {
      const timer = setTimeout(() => {
        setForbiddenDomainError(null)
        // Dispatch a custom event to notify sign-in buttons to stop loading
        window.dispatchEvent(new Event("forbidden-domain-error-dismissed"))
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [forbiddenDomainError])

  const signInWithGoogle = async () => {
    if (!isInitialized || !auth) {
      setGoogleError("Authentication is not initialized. Please refresh the page.")
      return
    }

    try {
      setGoogleError(null)
      const provider = googleProvider || new GoogleAuthProvider()
      await signInWithRedirect(auth, provider)
    } catch (error) {
      console.error("Error signing in with Google:", error)
      setGoogleError(error.message || "Google sign-in failed. Please try again.")
      throw error
    }
  }

  const signInWithEmail = async (email) => {
    if (!isInitialized || !auth) {
      console.error("Firebase auth is not initialized")
      setEmailLinkError("Authentication is not ready. Please refresh the page and try again.")
      return
    }

    setEmailLinkError(null)
    setEmailLinkSent(false)

    try {
      // URL to redirect back to after sign-in
      const actionCodeSettings = {
        // Your current domain is used here
        url: window.location.origin,
        handleCodeInApp: true,
      }

      console.log("Sending sign-in link to:", email, "with settings:", actionCodeSettings)

      // Send sign-in link to the user's email
      await sendSignInLinkToEmail(auth, email, actionCodeSettings)

      // Save the email in localStorage to use it later when completing sign-in
      localStorage.setItem("emailForSignIn", email)

      // Set state to show confirmation message
      setEmailLinkSent(true)
    } catch (error) {
      console.error("Error sending sign-in link:", error)
      setEmailLinkError(
        error instanceof Error
          ? `Failed to send sign-in link: ${error.message}`
          : "Failed to send sign-in link. Please try again.",
      )
    }
  }

  const completeEmailSignIn = async (email) => {
    if (!isInitialized || !auth) {
      console.error("Firebase auth is not initialized")
      return false
    }

    try {
      if (auth && isSignInWithEmailLink(auth, window.location.href)) {
        await signInWithEmailLink(auth, email, window.location.href)
        localStorage.removeItem("emailForSignIn")
        window.history.replaceState({}, document.title, window.location.pathname)
        return true
      }
      return false
    } catch (error) {
      console.error("Error completing email sign-in:", error)
      setEmailLinkError("Failed to complete sign-in. Please try again.")
      return false
    }
  }

  const signOut = async () => {
    if (!isInitialized || !auth) {
      console.error("Firebase auth is not initialized")
      return
    }

    try {
      await firebaseSignOut(auth)
      // Clear auth cookie
      document.cookie = "auth=; path=/; max-age=0"
    } catch (error) {
      console.error("Error signing out:", error)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        userRole,
        loading,
        signInWithGoogle,
        signInWithEmail,
        completeEmailSignIn,
        signOut,
        emailLinkError,
        emailLinkSent,
        forbiddenDomainError,
        googleError,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
