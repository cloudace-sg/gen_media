# AGENTS.md

## Cursor Cloud specific instructions

### Overview

This is a monorepo (npm workspaces) containing a React frontend (CRA) and Express.js backend for an AI-driven marketing media generation studio.

### Architecture

| Service | Port | Command |
|---------|------|---------|
| Express API server | 3001 | `cd server && npm run dev` (uses nodemon) |
| React dev server | 3000 | `cd client && npm run dev` (CRA with proxy to :3001) |

Both can be started together from root: `npm run dev` (uses concurrently).

### Key development notes

- **Authentication**: The app requires Firebase Auth. Without `REACT_APP_FIREBASE_*` env vars in `client/.env.local`, the UI shows a login page that cannot be bypassed. The server API endpoints are still accessible directly (no server-side auth enforcement on most routes in dev mode).
- **API keys**: The server needs `GOOGLE_GEMINI_API_KEY` in `server/.env` for image/video generation. Without it, generate/remix endpoints return 400 errors but the server still starts fine.
- **Health check**: `GET /api/health` on port 3001 confirms the server is running.
- **No automated tests**: The project has no test files. `CI=true npx react-scripts test --watchAll=false --passWithNoTests` exits 0.
- **Lint**: Run `cd client && npx eslint src/` — currently 0 errors, ~37 warnings.
- **Build**: `cd client && npm run build` succeeds (do NOT set `CI=true` as it treats warnings as errors).
- **Environment file**: Copy `server/env.example` to `server/.env` for the server to load configuration.
- **Package manager**: Uses npm with workspaces. A single `npm install` at root installs all dependencies (root + client + server).
- **Node.js version**: Requires Node.js 18 (matches Dockerfile `node:18-alpine`).
