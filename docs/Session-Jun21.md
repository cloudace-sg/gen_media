---
tags: [dev-log, brand-assets, auth, bug-fix]
status: updated
---

# Session Jun 21 — Brand Assets Fixes + Auth Race Fix

## What Was Fixed

### Auth — "Authentication is not ready" race condition
- **Root cause**: `useState(false)` for `isInitialized` in `auth-context.js` created a window between first render and `useEffect` firing where the sign-in gate was closed even though Firebase `auth` was already ready (module-level singleton).
- **Fix**: `useState(!!auth)` — initialise directly from the module-level singleton, eliminating the race entirely.
- **Commit**: `90e786e`
- **File**: `client/src/contexts/auth-context.js:53`

---

### Brand Assets — My Files picker

Added a "My Files" button to both the Hero Asset section and each ID Grid slot so users can pick from their existing file library (`/api/files`) instead of only uploading from disk.

**Bugs fixed along the way:**
1. `listFiles({ type: 'image' })` — `'image'` is not a valid type filter for `/api/files` (valid: `uploads`, `generated_images`, `generated_videos`, etc.). Removed type filter; filter videos client-side instead.
2. `data.files || data.results` — wrong response key. `/api/files` returns `{ items, nextPageToken }`. Fixed to `data.items || []`.

**Commits**: `129c5bd`, `07ae1f0`

---

### Brand Assets — Generate response unwrapping

`generateImages()` returns `{ results: [...], prompt, ... }` not a bare array.  
Both `handleGenerateHero` and `handleGenerateGridSlot` were doing `results[0]?.url` (treating the whole response as an array) — always `undefined`.

**Fix**: `(data.results || data)[0]?.url` — same pattern as the upload fix.  
**Commit**: `9d392f5`  
**Files**: `client/src/pages/BrandAssetsPage.jsx:206`, `:244`

---

### Brand Assets — Upload response unwrapping (prior session, deployed this session)

`uploadImages()` returns `{ results: [...], uploadedAt }` not a bare array.  
Both `handleUploadHero` and `handleUploadGridSlot` had the same bug.

**Fix**: `(data.results || data)[0]?.url`  
**Commit**: `129c5bd`

---

### ID Grid — Contact sheet preview modal

Previously "Make Contact Sheet" immediately:
1. Built the canvas contact sheet
2. Saved it to GCS
3. Staged it as a Veo reference
4. Navigated to `/canvas`

User had no way to see the stitched result before it was staged.

**Fix**: Replaced auto-navigation with a preview modal showing the full stitched contact sheet. User sees the image, then confirms with **Stage for Veo** (navigates to canvas) or **Cancel** (stays on Brand Assets).

**State added**: `sheetPreview: { dataUrl, savedUrl } | null`  
**New handler**: `handleStageContactSheet()`  
**Commit**: `fe6bdf5`

---

### ID Grid — Clarified description copy

Updated the description from *"4–9 product shots from different angles"* to explicitly state *"The same product from 4–9 different angles — each slot = one angle (front, side, top-down, etc.)"* to remove ambiguity about whether slots should have different products.

---

## Pattern Note — Response Shape

Three separate `uploadImages` / `generateImages` bugs all shared the same root cause: callers assumed the return value was a bare array but both functions return `{ results: [...], ... }`. The safe unwrap pattern used throughout is:

```js
const data = await someApi(...);
const url = (data.results || data)[0]?.url;
```

---

## Cloud Build Deploys This Session

| Build ID | Commit | Contents |
|---|---|---|
| `9bbb0391` | `129c5bd` | My Files picker + upload fix |
| `f129ba69` | `90e786e` | Auth race fix |
| `8c7f1c45` | `07ae1f0` | My Files picker API fix |
| `1a3d5256` | `9d392f5` | Generate response fix |
| `bc98bd80` | `fe6bdf5` | Contact sheet preview modal |
