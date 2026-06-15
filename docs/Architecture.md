---
tags: [architecture, dev-log]
status: updated
---

# gen_media — System Architecture

gen_media is a single-container AI media studio built on React (client), Express (API server), and nginx (reverse proxy), deployed to Google Cloud Run. All three processes run inside one Docker image: nginx listens on port 8080, serves the React SPA for all non-API paths, and reverse-proxies `/api/*` and `/uploads/*` to the Express server on localhost:3001. Firebase handles authentication; Google Gemini (via GeminiService) drives image and video generation; Google Cloud Storage backs file persistence.

## Architecture Overview

```
Browser
  │  HTTPS (Cloud Run ingress)
  ▼
nginx :8080
  ├── /api/*        → proxy → Express :3001
  ├── /uploads/*    → proxy → Express :3001
  ├── /health       → 200 "healthy" (nginx-native, no Express)
  └── /*            → React SPA (index.html fallback)
```

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, React Router v6, Zustand (`useStore`), Konva (canvas), Tailwind CSS |
| Backend | Node 18, Express 5, multer (file uploads), firebase-admin, @google-cloud/storage, @google-cloud/bigquery |
| AI Services | Google Gemini via `@google/genai` (GeminiService god node, 13 edges) |
| Auth | Firebase Authentication (email/domain whitelist via `allowedEmails` / `allowedDomains`) |
| Proxy | nginx:alpine |
| Deployment | Google Cloud Run (single container, port 8080) |

## Express API Routes

All routes are mounted under `/api/`:

| Mount | Purpose |
|---|---|
| `/api/search` | Image search |
| `/api/generate` | AI image/video generation (calls GeminiService) |
| `/api/remix` | Image remixing/compositing |
| `/api/uploads` | File upload intake (multer, 50 MB limit) |
| `/api/video` | Video-specific generation and handling |
| `/api/brandkit` | Brand kit CRUD |
| `/api/files` | User file management (GCS-backed) |
| `/api/styles` | Public style presets |
| `/api/prompt` | Prompt assistance |
| `/api/billing` | Usage/credit tracking (BigQuery) |
| `/api/users` | User management (admin) |
| `/api/auth` | Firebase token verification middleware |
| `/api/health` | Health check (JSON) |
| `/uploads/*` | Static serving of locally-uploaded assets |

The catch-all `GET *` handler returns `client/build/index.html` so Express can also serve the SPA directly without nginx (useful during local development).

## React Client Structure

- **Entry:** `App.js` wraps everything in `<AuthProvider>` (Firebase context), then renders `AppContent`.
- **Auth gate:** `AppContent` checks `useAuth().user`; unauthenticated users see `<LandingPage />`, authenticated users get `<ProtectedRoute> → <AppShell> → <AppRoutes>`.
- **Global state:** Zustand store (`useStore`) is the most connected node in the graph (32 edges). It holds selected images, modal state, lightbox, image viewer, drawer state, and brand assets.
- **Routing (AppRoutes.jsx):** All six page components are code-split via `React.lazy` + `Suspense`.

| Path | Page |
|---|---|
| `/canvas` | CanvasPage (default redirect) |
| `/brand` | BrandAssetsPage |
| `/users` | UsersPage (admin) |
| `/billing` | BillingPage |
| `/help` | HelpPage |
| `/files` | MyFilesPage |

## Docker Container Structure

Multi-stage build:

1. **Build stage** (`node:18-alpine`): installs client deps, bakes Firebase config as `REACT_APP_*` env-args, runs `npm run build`, copies server source.
2. **Production stage** (`nginx:alpine`): copies React build to `/usr/share/nginx/html`, copies nginx.conf, copies server to `/usr/share/nginx/server`, installs Node.js + npm inside the nginx image, installs server deps, writes `/start.sh`.

**Startup script** (`/start.sh`):
1. Sets `PORT=3001` and `ALLOWED_ORIGINS` for Express.
2. Launches `node src/index.js` in the background.
3. Sleeps 3 s (waits for Express to be ready).
4. Starts `nginx -g "daemon off;"` in the foreground (PID 1 equivalent).

The container exposes only port 8080 (Cloud Run requirement).

## nginx Configuration Details

- Listens on port 8080 (`server_name _`).
- `/api/` proxy: 600 s timeouts to support long-running video generation jobs.
- `/uploads/` proxy: 120 s timeouts, supports HTTP upgrade for streaming.
- `index.html`: served with `no-cache, no-store, must-revalidate` so UI deploys are immediately visible.
- Static assets (`*.js`, `*.css`, images): `Cache-Control: public, immutable; expires 1y`.
- Security headers: X-Frame-Options, X-XSS-Protection, X-Content-Type-Options, Referrer-Policy, Content-Security-Policy.
- Gzip enabled for text/JS/CSS/XML.
- `client_max_body_size 50M` to match Express's 50 MB body limit.

## CORS Strategy

Express CORS middleware allows:
1. Origins explicitly listed in `ALLOWED_ORIGINS` (comma-separated env var) or `CLIENT_URL`.
2. Any `*.run.app` hostname (Cloud Run auto-generated URLs).
3. Requests with no Origin header (curl, server-to-server).
4. `/uploads/*` static files use a separate permissive CORS block (`origin: true, credentials: false`) so canvas operations can load assets cross-origin.

## Firebase Authentication Flow

- Client uses Firebase SDK; `AuthProvider` + `useAuth()` expose user/loading state throughout the app.
- `allowedDomains` and `allowedEmails` whitelists gate sign-in.
- Server-side: `authenticate()` middleware in `routes/auth` verifies Firebase ID tokens via `firebase-admin`. `requireAdmin()` gates admin-only routes (`/api/users`, `/api/billing`).

## Key Decisions
- Single-container deployment (nginx + Node in one image): simplifies Cloud Run deployment to a single service with one port (8080), avoiding service-mesh complexity between frontend and backend containers.
- nginx as reverse proxy (not Express alone): Express already has a static-file fallback, but nginx adds production-grade gzip, immutable asset caching, no-cache on index.html for zero-downtime deploys, and correct security headers without application code changes.
- React SPA with catch-all route on both nginx and Express: nginx handles the browser-facing catch-all; Express has an identical fallback so the app works identically when running locally without nginx (development mode).
- Zustand over Redux for global state: lighter API, no boilerplate; useStore is the single most-connected node (32 edges) indicating it is the true coordination hub for UI state.
- React.lazy + Suspense for all page-level routes: keeps the initial bundle small; pages are only loaded when navigated to, which matters because CanvasPage (Konva-heavy) is the heaviest chunk.
- Firebase ID token verification on the server (firebase-admin): stateless JWT approach; no session store required, which is appropriate for Cloud Run's stateless container model.
- Firebase config baked in at Docker build time via ARG/ENV: Firebase client config is intentionally public (it is not a secret); baking it in avoids runtime config injection complexity on Cloud Run.
- 600-second proxy timeouts for /api/ routes: video generation with Google Gemini/Veo can take several minutes; default nginx timeouts (60s) would silently kill long-running jobs.
- Separate CORS policy for /uploads/: canvas operations (Konva) read pixel data cross-origin, which requires CORS headers on the asset response; using credentials:false here is correct since these are public read assets.
- Google Cloud Storage + BigQuery for persistence/billing: GCS gives durable file storage independent of the container's ephemeral filesystem; BigQuery provides scalable usage/billing analytics without a relational DB.

## Key Files
- `/home/angieng/CloudAceSG/Projects/gen_media/Dockerfile`
- `/home/angieng/CloudAceSG/Projects/gen_media/nginx.conf`
- `/home/angieng/CloudAceSG/Projects/gen_media/server/src/index.js`
- `/home/angieng/CloudAceSG/Projects/gen_media/client/src/App.js`
- `/home/angieng/CloudAceSG/Projects/gen_media/client/src/routes/AppRoutes.jsx`
- `/home/angieng/CloudAceSG/Projects/gen_media/client/src/store/useStore.js`
- `/home/angieng/CloudAceSG/Projects/gen_media/client/src/contexts/auth-context.js`
- `/home/angieng/CloudAceSG/Projects/gen_media/server/src/routes/auth.js`
- `/home/angieng/CloudAceSG/Projects/gen_media/server/src/services/GeminiService.js`

## Related
- [[Firebase Authentication (domain/email whitelist)]]
- [[GeminiService — Google Gemini/Veo integration]]
- [[useStore — Zustand global state shape]]
- [[Google Cloud Storage upload/signed-URL flow]]
- [[BigQuery billing and credit tracking]]
- [[Cloud Run deployment model]]
- [[Konva canvas editor (CanvasPage)]]
- [[Brand kit management]]
- [[Video generation pipeline and timeouts]]
