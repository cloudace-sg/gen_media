---
tags: [index, architecture]
status: updated
---

# gen_media — Knowledge Vault

AI-powered media generation platform built on Google Gemini (image) and Veo (video).

## Notes
- [[gen_media — System Architecture]]
- [[AI Services & Generation]]
- [[Reference Workflows]]
- [[Infrastructure & Storage]]
- [[Authentication]]
- [[Image & Video Search]]
- [[Git History & Key Decisions]]
- [[Session-Jun18-PM]] — Vertex AI migration, Ingredients UI, camera chips
- [[Session-Jun19]] — Vercel Open Skills CLI global setup (find-skills + agent-skills)
- [[Session-Jun20]] — Gemini video analysis standalone + VEO prompt pipeline (SOW-22 pre-integration)
- [[Session-Jun21]] — Brand Assets fixes: auth race, My Files picker, generate/upload response shape, contact sheet preview modal
- [[SOW_STATUS]] — live SOW completion tracker (4/32 done + 6 new additions)

## Quick Links
- [[Architecture]] — React + Express + nginx, Cloud Run deployment
- [[AI Services & Generation]] — Gemini models, Veo video, reference-guided generation
- [[Reference Workflows]] — 4 ways to use images/videos as generation references
- [[Infrastructure & Storage]] — GCS bucket, Cloud Build, env vars
- [[Authentication]] — Firebase email magic link + Google sign-in
- [[Image & Video Search]] — Pexels, Unsplash, Pixabay integration
- [[Decision Log]] — Git history and key architectural decisions

## Stack
- **Frontend:** React, Zustand, Tailwind CSS, Lucide icons
- **Backend:** Node.js / Express
- **AI:** Google Gemini (`gemini-3.1-flash-image-preview` image, `gemini-3.5-flash` text), Veo (`veo-3.1-generate-001` GA via Vertex AI, fallback `veo-3.1-generate-preview` on Developer API)
- **Storage:** Google Cloud Storage (`gen-media-demo-assets-sg`)
- **Auth:** Firebase Authentication (email link + Google)
- **Deploy:** Cloud Run via Cloud Build (`strong-kit-475107-k1`, `asia-southeast1`)
