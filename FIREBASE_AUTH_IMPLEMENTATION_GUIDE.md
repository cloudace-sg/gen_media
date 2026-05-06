# Firebase Authentication Implementation Guide

This guide provides step-by-step instructions for implementing Firebase Authentication in a Next.js application with Google Sign-in and Email Link authentication, including domain/email whitelisting.

## 📋 Prerequisites

- Next.js 14+ application
- Firebase project set up in Google Cloud Console
- Node.js 18+ installed

## 🔧 Step 1: Install Dependencies

```bash
npm install firebase
```

## 🔧 Step 2: Firebase Project Setup

### 2.1 Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project" or "Add project"
3. Enter project name and follow the setup wizard
4. Enable Google Analytics (optional)

### 2.2 Configure Authentication
1. In Firebase Console, go to **Authentication** → **Sign-in method**
2. Enable **Google** provider:
   - Click on Google
   - Toggle "Enable"
   - Add your project support email
   - Save
3. Enable **Email/Password** provider:
   - Click on Email/Password
   - Toggle "Enable" for "Email link (passwordless sign-in)"
   - Save

### 2.3 Get Firebase Configuration
1. Go to **Project Settings** (gear icon)
2. Scroll down to "Your apps" section
3. Click "Add app" → Web app (</> icon)
4. Register your app with a nickname
5. Copy the Firebase configuration object

## 🔧 Step 3: Environment Variables

Create a `.env.local` file in your project root:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

## 🔧 Step 4: Firebase Configuration

Create `lib/firebase.ts`:

```typescript
"use client"

import { initializeApp } from "firebase/app"
import { getAuth, GoogleAuthProvider } from "firebase/auth"

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

// Create a function to initialize Firebase
function initializeFirebase() {
  // Check if we're in a browser environment
  if (typeof window === "undefined") {
    return { app: null, auth: null, googleProvider: null }
  }

  try {
    // Initialize Firebase
    const app = initializeApp(firebaseConfig)

    // Initialize Auth
    const auth = getAuth(app)

    // Configure auth for email link sign-in
    if (auth) {
      auth.useDeviceLanguage()

      // Log configuration for debugging
      console.log("Firebase initialized with config:", {
        apiKey: firebaseConfig.apiKey ? "Set" : "Not set",
        authDomain: firebaseConfig.authDomain ? "Set" : "Not set",
        projectId: firebaseConfig.projectId ? "Set" : "Not set",
      })
    }

    // Initialize Google Provider
    const googleProvider = new GoogleAuthProvider()
    googleProvider.setCustomParameters({
      prompt: "select_account",
    })

    return { app, auth, googleProvider }
  } catch (error) {
    console.error("Firebase initialization error:", error)
    return { app: null, auth: null, googleProvider: null }
  }
}

// Initialize Firebase and export the instances
const { app, auth, googleProvider } = initializeFirebase()

if (auth) {
  auth.useDeviceLanguage()
}

export { app, auth, googleProvider }
```

## 🔧 Step 5: Authentication Context

Create `contexts/auth-context.tsx`:

```typescript
"use client"

import { createContext, useContext, useEffect, useState } from "react"
import type { User } from "firebase/auth"
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
} from "firebase/auth"
import { auth, googleProvider } from "@/lib/firebase"
import type React from "react"
import { useRouter } from "next/navigation"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface AuthContextType {
  user: User | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signInWithEmail: (email: string) => Promise<void>
  completeEmailSignIn: (email: string) => Promise<boolean>
  signOut: () => Promise<void>
  emailLinkError: string | null
  emailLinkSent: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signInWithGoogle: async () => {},
  signInWithEmail: async () => {},
  completeEmailSignIn: async () => false,
  signOut: async () => {},
  emailLinkError: null,
  emailLinkSent: false,
})

export const useAuth = () => useContext(AuthContext)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isInitialized, setIsInitialized] = useState(false)
  const [emailLinkError, setEmailLinkError] = useState<string | null>(null)
  const [emailLinkSent, setEmailLinkSent] = useState(false)
  const [forbiddenDomainError, setForbiddenDomainError] = useState<string | null>(null)
  const router = useRouter()
  const { toast } = useToast();

  // Configure allowed domains and emails
  const allowedDomains = ["yourdomain.com", "anotherdomain.com"];
  const allowedEmails = [
    "admin@yourdomain.com",
    "user@anotherdomain.com"
  ];

  // Initialize Firebase auth on component mount
  useEffect(() => {
    // Check if auth is available
    if (!auth) {
      console.warn("Firebase auth is not initialized")
      setLoading(false)
      return () => {}
    }

    setIsInitialized(true)

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const email = firebaseUser.email || "";
        const domain = email.split("@")[1]?.toLowerCase();
        if (!allowedDomains.some((d) => domain === d) && !allowedEmails.includes(email.toLowerCase())) {
          // Not allowed, sign out and show toast error
          if (auth) {
            await firebaseSignOut(auth);
          }
          setUser(null);
          toast({
            variant: "destructive",
            title: "Sign-in Error",
            description: "Only emails from allowed domains and selected emails are allowed.",
          });
          setLoading(false);
          return;
        }
      }
      setUser(firebaseUser)
      setLoading(false)

      // Set a cookie for server-side auth checks
      if (firebaseUser) {
        document.cookie = "auth=true; path=/; max-age=86400" // 24 hours

        // Redirect to dashboard if on landing page
        if (window.location.pathname === "/") {
          router.push("/dashboard")
        }
      } else {
        // Clear auth cookie when signed out
        document.cookie = "auth=; path=/; max-age=0"
      }
    })

    return () => unsubscribe()
  }, [router, toast])

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
            setEmailLinkError("Failed to sign in with email link. Please try again.")
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
      console.error("Firebase auth is not initialized")
      return
    }

    try {
      // If googleProvider is not available, create a new one
      const provider = googleProvider || new GoogleAuthProvider()
      await signInWithPopup(auth, provider)
    } catch (error) {
      console.error("Error signing in with Google:", error)
      throw error
    }
  }

  const signInWithEmail = async (email: string) => {
    if (!isInitialized || !auth) {
      console.error("Firebase auth is not initialized")
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

  const completeEmailSignIn = async (email: string): Promise<boolean> => {
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
      // Redirect to landing page
      router.push("/")
    } catch (error) {
      console.error("Error signing out:", error)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signInWithGoogle,
        signInWithEmail,
        completeEmailSignIn,
        signOut,
        emailLinkError,
        emailLinkSent,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
```

## 🔧 Step 6: Firebase Auth Provider

Create `components/auth/firebase-auth-provider.tsx`:

```typescript
"use client"

import { AuthProvider } from "@/contexts/auth-context"
import type React from "react"

export default function FirebaseAuthProvider({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}
```

## 🔧 Step 7: Email Sign-in Component

Create `components/auth/email-sign-in.tsx`:

```typescript
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/contexts/auth-context"
import { Mail, Loader2, CheckCircle, AlertCircle, ArrowLeft } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface EmailSignInProps {
  onBack?: () => void
}

export default function EmailSignIn({ onBack }: EmailSignInProps) {
  const { signInWithEmail, emailLinkError, emailLinkSent } = useAuth()
  const [email, setEmail] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  // Configure allowed domains and emails
  const allowedDomains = ["yourdomain.com", "anotherdomain.com"];
  const allowedEmails = [
    "admin@yourdomain.com",
    "user@anotherdomain.com"
  ];

  const isAllowedDomain = (email: string) => {
    const domain = email.split("@")[1]?.toLowerCase();
    const emailLower = email.toLowerCase();
    return allowedDomains.some((d) => domain === d) || allowedEmails.includes(emailLower);
  };

  const validateEmail = (email: string) => {
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

    if (!isAllowedDomain(email)) {
      setValidationError("Only emails from allowed domains and selected emails are allowed.")
      return
    }

    setIsSubmitting(true)
    try {
      await signInWithEmail(email)
    } catch (error) {
      console.error("Sign in error:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (emailLinkSent) {
    return (
      <div className="space-y-4">
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            Sign-in link sent! Please check your email ({email}) and click the link to sign in.
          </AlertDescription>
        </Alert>
        <p className="text-sm text-gray-600">
          If you don't see the email, check your spam folder. The link will expire after 24 hours.
        </p>
        {onBack && (
          <Button variant="ghost" onClick={onBack} className="text-gray-700 hover:text-gray-900">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to sign-in options
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {onBack && (
        <Button
          variant="ghost"
          onClick={onBack}
          className="mb-2 -ml-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      )}

      <div className="space-y-2">
        <Label htmlFor="email" className="text-gray-700">
          Email Address
        </Label>
        <Input
          id="email"
          type="email"
          placeholder="your.email@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border-gray-300 focus:border-blue-500"
        />
        {validationError && <p className="text-red-500 text-sm">{validationError}</p>}
      </div>

      {emailLinkError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{emailLinkError}</AlertDescription>
        </Alert>
      )}

      <Button
        onClick={handleSignIn}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-md py-6"
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Sending Link...
          </>
        ) : (
          <>
            <Mail className="mr-2 h-4 w-4" />
            Sign in with Email
          </>
        )}
      </Button>
      <p className="text-xs text-center text-gray-600">
        We'll send a sign-in link to your email.
        <br />
        No password required!
      </p>
    </div>
  )
}
```

## 🔧 Step 8: Google Sign-in Component

Create `components/auth/sign-in-button.tsx`:

```typescript
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
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
    <Button
      onClick={handleGoogleSignIn}
      className="w-full bg-white hover:bg-gray-50 text-gray-900 border border-gray-300 rounded-md py-6"
      disabled={isLoading}
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Signing in...
        </>
      ) : (
        <>
          <Chrome className="mr-2 h-4 w-4" />
          Sign in with Google
        </>
      )}
    </Button>
  )
}
```

## 🔧 Step 9: User Profile Component

Create `components/auth/user-profile.tsx`:

```typescript
"use client"

import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { LogOut, User } from "lucide-react"

export default function UserProfile() {
  const { user, signOut } = useAuth()

  if (!user) return null

  const handleSignOut = async () => {
    try {
      await signOut()
    } catch (error) {
      console.error("Sign out error:", error)
    }
  }

  return (
    <div className="flex items-center space-x-4">
      <Avatar>
        <AvatarImage src={user.photoURL || ""} alt={user.displayName || "User"} />
        <AvatarFallback>
          <User className="h-4 w-4" />
        </AvatarFallback>
      </Avatar>
      <div className="flex flex-col">
        <span className="text-sm font-medium">{user.displayName || user.email}</span>
        <span className="text-xs text-gray-500">{user.email}</span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleSignOut}
        className="text-gray-500 hover:text-gray-700"
      >
        <LogOut className="h-4 w-4" />
      </Button>
    </div>
  )
}
```

## 🔧 Step 10: Protected Route Component

Create `components/auth/protected-route.tsx`:

```typescript
"use client"

import { useAuth } from "@/contexts/auth-context"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { Loader2 } from "lucide-react"

interface ProtectedRouteProps {
  children: React.ReactNode
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push("/")
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  return <>{children}</>
}
```

## 🔧 Step 11: App Layout Integration

Update your `app/layout.tsx`:

```typescript
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toaster"
import FirebaseAuthProvider from "@/components/auth/firebase-auth-provider"

const inter = Inter({ subsets: ["latin"] })

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <Toaster />
          <FirebaseAuthProvider>
            {children}
          </FirebaseAuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
```

## 🔧 Step 12: Usage Examples

### Landing Page with Sign-in Options

```typescript
"use client"

import { useState } from "react"
import SignInButton from "@/components/auth/sign-in-button"
import EmailSignIn from "@/components/auth/email-sign-in"
import { Mail, Chrome } from "lucide-react"

export default function LandingPage() {
  const [showEmailSignIn, setShowEmailSignIn] = useState(false)

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">Welcome</h1>
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

            <Button
              variant="outline"
              onClick={() => setShowEmailSignIn(true)}
              className="w-full"
            >
              <Mail className="mr-2 h-4 w-4" />
              Sign in with Email
            </Button>
          </div>
        ) : (
          <EmailSignIn onBack={() => setShowEmailSignIn(false)} />
        )}
      </div>
    </div>
  )
}
```

### Protected Dashboard

```typescript
"use client"

import ProtectedRoute from "@/components/auth/protected-route"
import UserProfile from "@/components/auth/user-profile"

export default function Dashboard() {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-6">
              <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
              <UserProfile />
            </div>
          </div>
        </header>
        
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="border-4 border-dashed border-gray-200 rounded-lg h-96 flex items-center justify-center">
              <p className="text-gray-500">Your protected content goes here</p>
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  )
}
```

## 🔧 Step 13: Configuration

### Domain/Email Whitelisting

In `contexts/auth-context.tsx`, update the allowed domains and emails:

```typescript
const allowedDomains = ["yourdomain.com", "anotherdomain.com"];
const allowedEmails = [
  "admin@yourdomain.com",
  "user@anotherdomain.com"
];
```

### Email Templates (Optional)

1. Go to Firebase Console → Authentication → Templates
2. Customize the email templates for better branding
3. Update the action URL to match your domain

## 🔧 Step 14: Testing

### Test Google Sign-in
1. Run your application: `npm run dev`
2. Click "Sign in with Google"
3. Complete the Google OAuth flow
4. Verify user is signed in and redirected

### Test Email Sign-in
1. Enter an allowed email address
2. Check your email for the sign-in link
3. Click the link to complete sign-in
4. Verify user is signed in and redirected

## 🔧 Step 15: Deployment Considerations

### Environment Variables
- Ensure all Firebase environment variables are set in your deployment platform
- Use different Firebase projects for development/staging/production

### Domain Configuration
- Add your production domain to Firebase Console → Authentication → Settings → Authorized domains
- Update the `actionCodeSettings.url` in the email sign-in function

### Security
- The domain/email whitelisting provides basic access control
- Consider implementing additional role-based access control (RBAC) for more complex scenarios
- Monitor authentication logs in Firebase Console

## 🎯 Key Features Implemented

✅ **Google Sign-in** - One-click authentication with Google  
✅ **Email Link Authentication** - Passwordless email sign-in  
✅ **Domain/Email Whitelisting** - Restrict access to specific domains and emails  
✅ **Automatic Redirects** - Seamless user experience  
✅ **Error Handling** - Comprehensive error messages and validation  
✅ **Loading States** - User feedback during authentication  
✅ **Cookie-based Server Auth** - Server-side authentication checks  
✅ **TypeScript Support** - Full type safety  

## 🚀 Next Steps

1. Customize the UI components to match your brand
2. Implement role-based access control if needed
3. Add user profile management
4. Set up email templates in Firebase Console
5. Configure production domains and security rules

This implementation provides a robust, production-ready Firebase authentication system with both Google and email sign-in options, complete with domain whitelisting and comprehensive error handling.
