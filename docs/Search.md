---
tags: [search, pexels, pixabay, dev-log]
status: updated
---

# Image & Video Search

The gen_media project integrates three stock-media providers (Pexels, Unsplash, Pixabay) for image search, but only two (Pexels, Pixabay) for video search. All providers are called concurrently and their results are interleaved in round-robin order before being returned to the client. Search mode is toggled in the UI via a "Search / Create" button pair in PromptDrawer.

# Image & Video Search — Architecture Details

## Providers and Capability Matrix

| Provider | Image Search | Video Search | API Key Env Var |
|---|---|---|---|
| Pexels | Yes | Yes | `PEXELS_API_KEY` |
| Unsplash | Yes | No | `UNSPLASH_ACCESS_KEY` |
| Pixabay | Yes | Yes | `PIXABAY_API_KEY` |

At least one image-provider key must be set for image search; at least one of Pexels or Pixabay must be set for video search. Unsplash has no video API and is therefore excluded from the `/search/videos` route.

## Server Routes (`server/src/routes/search.js`)

Two Express routes are registered on the router:

- `GET /` — multi-source image search, accepts `query` and `num` (default 10)
- `GET /videos` — multi-source video search, accepts `query` and `num` (default 10)

### Per-source budget
`perSource = ceil(num / activeProviderCount)` — each configured provider is asked for an equal share of the requested total.

### Concurrent fetch
All provider calls are fired with `Promise.all()` and a 5000 ms per-call timeout. Individual provider failures are caught and logged as warnings; the route continues with whatever results were returned by the surviving providers.

### Result merging — interleave
Results from all providers are merged via a round-robin `interleave()` function:

```
interleave([P1, P2], [U1, U2], [X1, X2])
  → [P1, U1, X1, P2, U2, X2]
```

The merged array is then sliced to the requested `num`. This ensures visual diversity — no single provider dominates the top of the result list.

### Result shape (normalised across providers)
Each result object carries: `id` (namespaced, e.g. `pexels_123`), `title`, `url` (full-res), `thumbnail`, `source` (provider + author attribution), `width`, `height`. Video results additionally carry `duration`, `type: 'video'`, and `mediaType: 'video'`.

### Pexels video quality selection
For Pexels videos, the code picks the `hd` quality file first, falling back to `video_files[0]`.

### Pixabay video quality selection
For Pixabay videos, the priority is `large > medium > small` from the `videos` object; thumbnails are sourced from Vimeo CDN using `picture_id`.

## Client UI (`client/src/components/PromptDrawer.js`)

- `isSearchMode` is a React state boolean, defaulting to `true` (search is the default mode on load).
- The UI renders two toggle buttons — "Search" and "Create" — that flip `isSearchMode`.
- On submit, when `isSearchMode` is true and `outputMode` is `'video'`, `searchVideos(prompt, 1, 30)` is called; otherwise `searchImages(prompt, 1, 30, 'creative_commons')` is called.
- The text placeholder on the prompt input also switches between "Search for videos…" / "Search for images…" (search mode) and "Describe the video…" / "Describe an image to create…" (create mode).
- The submit button label renders "Search" vs "Create" / "Processing…" accordingly.
- Both `searchImages` and `searchVideos` are imported from `../services/api`.

## API Key Requirements

All three keys are optional individually, but at least one image-provider key must exist for image search, and at least one of `PEXELS_API_KEY` / `PIXABAY_API_KEY` must exist for video search. If no suitable key is configured the server returns HTTP 500 with a descriptive message listing which env vars to set.

## Key Decisions
- Unsplash is excluded from video search because Unsplash has no video API; only Pexels and Pixabay support video.
- Results from multiple providers are interleaved in round-robin order (not concatenated) so no single provider dominates the top of the result list.
- Provider calls use Promise.all with individual try/catch so a single provider outage does not fail the entire request.
- Each provider receives ceil(num / activeProviderCount) results so the budget is distributed evenly regardless of how many providers are configured.
- Search mode defaults to true (isSearchMode = true) in PromptDrawer, making search the primary entry point over generative creation.
- API keys are read at request time via getKeys() rather than at module load, allowing hot env-var changes without a server restart.

## Key Files
- `/home/angieng/CloudAceSG/Projects/gen_media/server/src/routes/search.js`
- `/home/angieng/CloudAceSG/Projects/gen_media/client/src/components/PromptDrawer.js`
- `/home/angieng/CloudAceSG/Projects/gen_media/client/src/services/api.js`

## Related
- [[Reference image upload workflow]]
- [[Generative image/video creation (Create mode)]]
- [[Stock media licensing (all results are free-for-commercial-use)]]
- [[Environment variable configuration for API keys]]
- [[Result normalisation and thumbnail rendering in the media grid]]
