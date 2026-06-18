---
tags: [auth, firebase, dev-log]
status: updated
---

# Authentication

The gen_media project uses Firebase project `strong-kit-475107-k1` for authentication. It supports two sign-in methods: email magic link (passwordless) and Google OAuth popup. Firebase config is embedded into the React bundle at Docker build time via `ARG`/`ENV` directives — if those build args are missing, every `REACT_APP_FIREBASE_*` value becomes `undefined` and Firebase initialises silently with a broken config. The server verifies Firebase ID tokens using the Admin SDK and enforces an invite-only role model via Firestore and custom claims.

# Authentication System — gen_media

## Firebase Project
- Project ID: `strong-kit-475107-k1`
- Auth domain: controlled by `REACT_APP_FIREBASE_AUTH_DOMAIN` (typically `strong-kit-475107-k1.firebaseapp.com`)

## Client-Side Initialization (`client/src/lib/firebase.js`)
- Reads all six `REACT_APP_FIREBASE_*` env vars at module load time.
- Calls `initializeApp(firebaseConfig)` once in a browser guard (`typeof window !== "undefined"`).
- Creates a `GoogleAuthProvider` with `prompt: "select_account"` to force account chooser.
- In non-production builds, logs every env var value to the console for debugging.

## Sign-In Flows (`client/src/contexts/auth-context.js`)

### Email Magic Link
1. `EmailSignIn.js` collects the user's email.
2. Before sending the link, `checkUserExists(email)` is called to the backend — in production the user must already have been invited (exist in Firebase Auth); in dev mode a `localStorage` list of local users is checked first, falling back to a hardcoded domain/email allowlist (`cloud-ace.com`, `anotherdomain.com`).
3. `sendSignInLinkToEmail(auth, email, actionCodeSettings)` dispatches the magic link.
4. The link URL lands back on the app; `isSignInWithEmailLink` + `signInWithEmailLink` complete the flow.

### Google Sign-In Popup
1. `signInWithGoogle()` calls `signInWithPopup(auth, googleProvider)`.
2. On success, `onAuthStateChanged` fires and `updateUserRole` runs the same authorization checks as email (production: `checkUserExists`; dev: localStorage / domain allowlist).

## Post-Sign-In Role Resolution (`server/src/routes/auth.js` — `/postSignIn`)
- Client POSTs to `/api/auth/postSignIn` with a Bearer token immediately after sign-in.
- Server middleware (`auth.js`) calls `admin.auth().verifyIdToken(token)` and attaches decoded claims to `req.user`.
- If the token already carries a `role` custom claim, the user is admitted immediately.
- Otherwise the server reads `settings/auth` from Firestore for an exceptions list and a `defaultRole`.
- If the email is in the exceptions list, `setCustomUserClaims(uid, { role })` is called and the role is returned.
- If the email domain is in `trustedDomains` (`cloud-ace.com`), the user is auto-granted `defaultRole` (`editor`). Added in `05c03fd`.
- If no role, not in exceptions, and not a trusted domain → **403** "Not invited. Contact an administrator." (invite-only enforcement).
- `requireAdmin` middleware additionally gates admin-only routes by checking `req.user.role === 'admin'`.

## Firestore `settings/auth` Document Structure
The `postSignIn` endpoint reads `settings/auth` from Firestore. The document must use **Firestore map objects** — not JSON strings — or the exceptions lookup silently fails.

Correct structure:
```
allowedDomains: []           (array, currently unused by postSignIn)
defaultRole:    "editor"     (string)
exceptions:     [            (array of map objects)
  { email: "user@example.com", role: "admin" }
]
```

**Incident (2026-06-18):** The `exceptions` field was stored as an array containing a raw JSON string (`['[{"email":...}]']`) instead of an array of Firestore maps. The `exceptions.find(x => x.email === ...)` lookup iterated over a string and never matched — all exception users fell through to the trusted-domain path and got `editor` instead of their configured role. Fixed directly in Firestore via REST API.

## Build-Time Config Baking (Dockerfile)
- Create React App inlines `process.env.REACT_APP_*` values at `npm run build` time — they are **not** runtime env vars.
- The Dockerfile declares each var as an `ARG`, then promotes it to `ENV` so the build step can see it:
  ```dockerfile
  ARG REACT_APP_FIREBASE_API_KEY
  ENV REACT_APP_FIREBASE_API_KEY=$REACT_APP_FIREBASE_API_KEY
  ...
  RUN npm run build
  ```
- **Why it was broken before:** if `docker build --build-arg REACT_APP_FIREBASE_API_KEY=...` args were not supplied (e.g. the CI pipeline or Cloud Run build trigger did not pass them), every value became the string `"undefined"`, Firebase received an invalid config, and auth silently failed at runtime.

## What Still Needs to Be Done in Firebase Console

### Enable Sign-In Methods
In Firebase Console → Authentication → Sign-in method, enable:
- **Email/Password** (required for email link / passwordless)
- **Email link (passwordless sign-in)** toggle under Email/Password
- **Google** (for the popup flow)

### Authorized Domains
In Firebase Console → Authentication → Settings → Authorized domains, add every domain the app is served from, for example:
- `localhost` (already present by default)
- The Cloud Run service URL (e.g. `gen-media-xxxx-uc.a.run.app`)
- Any custom domain mapped to the service

Without these entries, Firebase will block the OAuth redirect/popup with an `auth/unauthorized-domain` error.

### Service Account for Admin SDK
The server reads `FIREBASE_SERVICE_ACCOUNT` (or a key file path) at startup. Confirm the Cloud Run service has the correct secret/env var so `admin.auth().verifyIdToken()` works in production.

## Key Decisions
- REACT_APP_FIREBASE_* vars must be passed as --build-arg to docker build; they cannot be injected at container runtime because CRA inlines them at bundle time.
- Production auth is invite-only: a user must be pre-created via /invite before they can sign in; the /postSignIn endpoint enforces this and returns 403 otherwise.
- Role is stored as a Firebase custom claim (role) on the ID token; the server sets it via setCustomUserClaims after verifying the user is in the Firestore exceptions list.
- Development mode bypasses Firebase invite checks and uses a localStorage localUsers list plus a hardcoded domain allowlist (cloud-ace.com) as fallback.
- Google sign-in uses a popup (not redirect) with prompt=select_account to force account chooser every time.
- The Dockerfile uses a multi-stage build: Node 18 Alpine for the React build, then nginx:alpine for serving; the Node API server is also bundled into the nginx image and started via /start.sh.

## Key Files
- `/home/angieng/CloudAceSG/Projects/gen_media/client/src/lib/firebase.js`
- `/home/angieng/CloudAceSG/Projects/gen_media/client/src/contexts/auth-context.js`
- `/home/angieng/CloudAceSG/Projects/gen_media/client/src/components/auth/EmailSignIn.js`
- `/home/angieng/CloudAceSG/Projects/gen_media/server/src/middleware/auth.js`
- `/home/angieng/CloudAceSG/Projects/gen_media/server/src/routes/auth.js`
- `/home/angieng/CloudAceSG/Projects/gen_media/Dockerfile`

## Related
- [[Firebase custom claims and role-based access control]]
- [[Create React App build-time environment variable inlining]]
- [[Docker multi-stage builds with ARG/ENV promotion]]
- [[Firebase Admin SDK token verification]]
- [[Firebase authorized domains for OAuth]]
- [[Passwordless email link authentication flow]]
- [[Firestore settings collection for auth exceptions]]
