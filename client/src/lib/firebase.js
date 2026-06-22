import { initializeApp, getApps, getApp } from "firebase/app"
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

// Create a function to initialize Firebase
let firebaseInitError = null

function initializeFirebase() {
  // Check if we're in a browser environment
  if (typeof window === "undefined") {
    return { app: null, auth: null, googleProvider: null }
  }

  try {
    // Reuse existing app if already initialized (prevents duplicate-app error)
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()

    const auth = getAuth(app)

    if (auth) {
      auth.useDeviceLanguage()
    }

    const googleProvider = new GoogleAuthProvider()
    googleProvider.setCustomParameters({ prompt: "select_account" })

    console.log("Firebase initialized:", {
      apiKey: firebaseConfig.apiKey ? "Set" : "MISSING",
      authDomain: firebaseConfig.authDomain ? "Set" : "MISSING",
      projectId: firebaseConfig.projectId ? "Set" : "MISSING",
      appId: firebaseConfig.appId ? "Set" : "MISSING",
      appsCount: getApps().length,
    })

    return { app, auth, googleProvider }
  } catch (error) {
    firebaseInitError = error
    console.error("Firebase initialization error:", error.code || error.message, error)
    return { app: null, auth: null, googleProvider: null }
  }
}

// Initialize Firebase and export the instances
const { app, auth, googleProvider } = initializeFirebase()

export { app, auth, googleProvider, firebaseInitError }
