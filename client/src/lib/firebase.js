import { initializeApp } from "firebase/app"
import { getAuth, GoogleAuthProvider } from "firebase/auth"

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
}

// Avoid logging secrets in production builds
if (process.env.NODE_ENV !== 'production') {
  console.log("Environment variables check:", {
    REACT_APP_FIREBASE_API_KEY: process.env.REACT_APP_FIREBASE_API_KEY,
    REACT_APP_FIREBASE_AUTH_DOMAIN: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
    REACT_APP_FIREBASE_PROJECT_ID: process.env.REACT_APP_FIREBASE_PROJECT_ID,
    REACT_APP_FIREBASE_STORAGE_BUCKET: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
    REACT_APP_FIREBASE_MESSAGING_SENDER_ID: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
    REACT_APP_FIREBASE_APP_ID: process.env.REACT_APP_FIREBASE_APP_ID,
  })
  console.log("Firebase config object:", firebaseConfig)
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
