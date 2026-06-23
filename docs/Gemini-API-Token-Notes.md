---
tags: [infra, auth, gemini, api-keys]
status: updated
---

# Gemini API Token — Notes & Known Issues

## Two Different Token Types in Use

### 1. Standard AI Studio API Key (`AIza...`)
- Obtained from [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
- Format: `AIzaSy...` (starts with `AIza`)
- Does **not** expire — permanent until revoked
- Set as `GOOGLE_GEMINI_API_KEY` on Cloud Run
- This is the correct long-term key to use

### 2. OAuth Access Token (`AQ....`)
- Obtained via `gcloud auth print-access-token` or extracted from a browser session
- Format: `AQ.Ab8RN6Li-...` (starts with `AQ.`)
- **Expires after ~1 hour** — short-lived bearer token
- Works for Gemini API calls (Google accepts OAuth tokens across its APIs)
- Was used as `GOOGLE_GEMINI_API_KEY` during early Jun 20 testing — it worked but is not suitable for a long-running server

## The "Hacking" Episode (Jun 20 session)

During standalone video analysis setup (`scripts/analyze-video.js`), the user pasted an `AQ.` OAuth token as the API key. Claude flagged the format mismatch ("Gemini API keys start with `AIza...`") but set it anyway. The script ran successfully — confirming OAuth tokens are accepted by the Gemini endpoint.

**Why it worked:** Google's Gemini API accepts both API keys and OAuth bearer tokens for authentication. The `AQ.` format is an OAuth 2.0 access token issued by Google's auth servers.

**Why it's a problem for production:** Access tokens expire in ~1 hour. When the token expires, all Gemini API calls fail with `auth/invalid-api-key` or similar errors — which looks identical to a misconfigured key.

## If Gemini API Stops Working on Cloud Run

Check in this order:
1. `gcloud run services describe gen-media-demo --region asia-southeast1 --format="value(spec.template.spec.containers[0].env)"` — verify `GOOGLE_GEMINI_API_KEY` is set
2. If the value starts with `AQ.` — it's an expired OAuth token. Replace it with a proper `AIza...` key from AI Studio
3. If the value starts with `AIza...` but still fails — the key may have been revoked. Generate a new one at [aistudio.google.com/apikey](https://aistudio.google.com/apikey)

## How to Get a Proper API Key

1. Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Sign in with the Cloud Ace Google account
3. Click **Create API key** → select project `strong-kit-475107-k1`
4. Copy the `AIza...` key
5. Update Cloud Run: `gcloud run services update gen-media-demo --region asia-southeast1 --update-env-vars GOOGLE_GEMINI_API_KEY=AIza...`

## Related

- [[Infrastructure]] — full list of Cloud Run env vars
- [[Side-Questions-Jun20-21]] — context on the video analysis session where this came up
