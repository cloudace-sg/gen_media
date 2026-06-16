---
tags: [references, staging, dev-log]
status: updated
---

# Reference Workflows

The gen_media project has 4 distinct paths for adding reference images/videos into the Zustand stagedImages store, each with different trust levels, storage concerns, and deduplication behaviour. All paths converge on the same stageImage() action in useStore, and all staged refs are forwarded as refs[] on POST /generate or POST /generate-video.

## The 4 Reference Workflows

### 1. Search → Save → Stage (search→ref)

**Entry point:** Workspace.js `handleStageSearchImage()`

**Flow:**
1. User clicks an image in a `search`-type row on the canvas.
2. `handleStageSearchImage` checks `stagedImages.some(s => s.id === image.id)` — if already staged, it unstages instead (toggle behaviour).
3. If not staged, it checks whether the URL is **external** (not localhost, not same hostname, not a data URI, not a relative path).
4. For external URLs, it calls `saveImageUrl(image.url)` → `POST /api/uploads/save-url` on the server.
5. The server proxies the URL via `axios.get(url, { responseType: 'arraybuffer' })`, detects content type, and uploads to GCS under `users/{userId}/uploads/{year}/{month}/search_{timestamp}.{ext}`.
6. The server returns `{ id, url, thumbnail, source: 'Saved from search' }`.
7. The client calls `stageImage({ ...image, id: saved.id || image.id, url: saved.url, thumbnail: saved.thumbnail })` — the GCS URL replaces the external URL.
8. If the proxy fails, it falls through and stages the original external URL anyway.

**Why proxying is required:** External image URLs (stock photo CDNs, search APIs) are ephemeral, CORS-restricted, and cannot be sent directly to Vertex AI / Veo. Storing them in GCS gives a stable `gs://` URI that Vertex/Veo can access server-side.

**Save to My Files variant:** The row-level "Save to My Files" button (`handleSaveRowToFiles`) runs the same proxy logic for every image in the row and updates `row.images` in place — it does not stage them, it just persists them.

---

### 2. Upload → Stage (upload→ref)

**Entry point:** Workspace.js `onImageSelect` handler for `upload`-type rows.

**Flow:**
1. User uploads files via the upload control (handled elsewhere; results land in an `upload`-type row in the store).
2. Clicking an image in an upload row calls `stageImage(image)` directly — no proxy step, because the URL is already a local `/api/uploads/...` path or a GCS URL returned during upload.
3. Toggle: if `stagedImages.some(staged => staged.id === image.id)` is true, `unstageImage(image.id)` is called instead.

**Why no proxy needed:** The URL is already owned/controlled (localhost or GCS), so it can be forwarded to the generation API without re-fetching.

---

### 3. Generated/Remix → My Files → Stage (generated→myfiles→ref)

**Entry point:** MyFilesPage.jsx `handleUseAsReference()`

**Flow:**
1. User navigates to `/my-files`, which lists GCS objects via `GET /api/uploads/list`.
2. Clicking "Use as Reference" calls `handleUseAsReference(fileItem)` which calls `stageImage()` for each selected item.
3. The staged object is constructed as: `{ id: it.key, title: filename, url: it.url, thumbnail: it.url, source: it.type, mediaType: isVideo ? 'video' : 'image' }`.
4. The `mediaType` field is set based on `it.contentType` — this matters downstream: PromptDrawer.js separates `imageRefs` and `videoRefs` before calling the generation API.
5. No navigation happens after staging — the user manually returns to the canvas to compose the prompt.

**Deduplication:** Relies on `id: it.key` (the GCS object key, e.g. `users/anonymous/generated_images/2026/06/img_123.jpg`). Since `stageImage` in useStore uses this id, calling it twice for the same key would produce a duplicate unless the store deduplicates — see Deduplication section below.

---

### 4. Brand Assets → Stage (brand→ref)

**Two sub-paths:**

**a. From Workspace canvas (Workspace.js):**
- Brand logos are rendered inline in a special "BRAND ASSETS" section at the top of the canvas using synthetic ids: `brand_logo_{idx}`.
- Clicking a logo calls `stageImage({ id: 'brand_logo_0', title: 'Brand Logo', url, thumbnail: url, source: 'Brand Kit' })` directly.
- Toggle: checks `stagedImages.some(staged => staged.id === image.id)`.

**b. From BrandAssetsPage.jsx:**
- Each logo has a "+" button that calls `stageImage({ id: 'brand_logo_{idx}', ... })` then immediately calls `navigate('/canvas')` to return to the workspace.

**No proxy needed:** Brand logo URLs are already stored in GCS (uploaded during brand kit setup).

---

## The Staging System — Zustand stagedImages

All 4 workflows write to the same `stagedImages` array in the Zustand store (`useStore`). The key actions are:

- `stageImage(image)` — appends an image object to `stagedImages`.
- `unstageImage(id)` — removes the entry with matching `id`.
- Toggle pattern used everywhere: `stagedImages.some(s => s.id === image.id)` — if already present, call `unstageImage`; otherwise call `stageImage`.

**Deduplication:** Deduplication is **caller-side only** — every call site checks `stagedImages.some(s => s.id === image.id)` before calling `stageImage`. The store action itself does not deduplicate on write. This means if two different code paths stage the same logical image with different `id` values, duplicates can appear.

The `id` values used per workflow:
- Search results: `saved.id` (from server, `upload_{timestamp}`) or original image id.
- Uploads: image id from the upload row.
- My Files: GCS object key (`it.key`).
- Brand assets: synthetic `brand_logo_{idx}` (index-based, stable for a given brand kit state).

---

## How Staged Refs Flow into Generation

In PromptDrawer.js (`handleGenerate`):

- `const refs = stagedImages.map(img => ({ id, url, title, mediaType }))` — all staged items forwarded.
- For image generation: `generateImages(prompt, style, count, aspectRatio, styleId, refs)` → `POST /generate` with `refs` array.
- For video generation: image refs and video refs are split. Image refs go as style/character references; video refs are passed only when no image refs are present (server uploads video to GCS and passes `gs://` URI to Veo).
- The canvas row created by the result includes `sourceImages: stagedImages` for provenance tracking.

---

## Why External Search URLs Must Be Proxied

1. **CORS:** Browser cannot relay external CDN images to a server-side AI API.
2. **Ephemerality:** Search result URLs expire or rotate.
3. **Vertex AI / Veo access:** The generation backend needs either a base64 blob or a `gs://` URI — it cannot reach arbitrary external URLs.
4. **Consistent storage:** Proxied images are stored under the user's GCS path, making them available in My Files for future sessions.


## Video Thumbnail Display in the Workspace Grid (ImageRow.js)

Generated videos from Veo have no `thumbnail` property set (only `url` and `mediaType: 'video'`). `ImageRow.js` renders video cards using:

- If `item.thumbnail` exists: `<img src={thumbnail} />` (used for search result videos which have thumbnails from the API).
- If `item.thumbnail` is absent: `<video src={item.url} muted preload="metadata" playsInline />` — the browser loads enough metadata to render the first frame as a still, giving a visual thumbnail for generated videos.

**Play vs Stage click separation:**
- Clicking the centered play-circle overlay calls `onImageClick` → `openImageViewer` (right panel video player).
- The `+`/`X` reference button is positioned `absolute top-1 right-1 z-10` with `opacity-0 group-hover:opacity-100`. On small screens the button's click area can overlap the centered play circle. Adding `pointer-events-none group-hover:pointer-events-auto` ensures the invisible button cannot intercept clicks; it only becomes interactive after the hover transition reveals it.
- Same `pointer-events-none group-hover:pointer-events-auto` fix applied to `ImageThumbnail.js` for image items.

---

## Key Decisions
- External search URLs are always proxied through POST /api/uploads/save-url before staging, to convert ephemeral CDN URLs into stable GCS URIs that Vertex AI can access.
- Deduplication is enforced at every call site via stagedImages.some(s => s.id === image.id) rather than inside the stageImage store action, making the store a simple append-only list.
- Brand assets use synthetic index-based IDs (brand_logo_{idx}) rather than GCS keys, which means brand kit reordering could cause id collisions in stagedImages.
- My Files staging sets mediaType from contentType so PromptDrawer can route image refs and video refs to separate Vertex/Veo parameters.
- The save-url proxy falls through silently on failure, staging the original external URL as a best-effort fallback.
- BrandAssetsPage auto-navigates to /canvas after staging; MyFilesPage deliberately does not, allowing the user to stage multiple items before returning.
- Video cards with no thumbnail use a `<video preload="metadata">` element so the browser renders the first frame as a still thumbnail. Do NOT use `pointer-events: auto` on hover-only buttons while they are `opacity-0` — on small screens their click area can overlap the centered play circle and silently intercept the first click.

## Key Files
- `/home/angieng/CloudAceSG/Projects/gen_media/client/src/components/Workspace.js`
- `/home/angieng/CloudAceSG/Projects/gen_media/client/src/components/PromptDrawer.js`
- `/home/angieng/CloudAceSG/Projects/gen_media/server/src/routes/uploads.js`
- `/home/angieng/CloudAceSG/Projects/gen_media/client/src/pages/MyFilesPage.jsx`
- `/home/angieng/CloudAceSG/Projects/gen_media/client/src/pages/BrandAssetsPage.jsx`
- `/home/angieng/CloudAceSG/Projects/gen_media/client/src/store/useStore.js`
- `/home/angieng/CloudAceSG/Projects/gen_media/client/src/services/api.js`

## Related
- [[Zustand store stageImage/unstageImage actions]]
- [[GCS upload pipeline (uploadBuffer)]]
- [[POST /generate refs[] parameter handling on the server]]
- [[Veo video generation with gs:// URIs]]
- [[Brand Kit setup and logo storage]]
- [[My Files pagination (listFiles, nextPageToken)]]
- [[save-edit route for edited image persistence]]
