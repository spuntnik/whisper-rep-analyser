# Predicate Analyzer App

Standalone Next.js MVP for meeting transcription, summary extraction, and predicate analysis.

## What it does

- Upload audio or record a meeting
- Send the audio to the OpenAI transcription API
- Generate meeting notes, key points, timestamps, and action items
- Score Visual, Auditory, Kinesthetic, and Auditory Digital language
- Export the combined report as Markdown or print it to PDF

## Environment

Create a local environment file from [`./.env.local.example`](./.env.local.example) and set:

- `OPENAI_API_KEY`
- If you choose Firebase later, fill the `NEXT_PUBLIC_FIREBASE_*` and `FIREBASE_*` entries.
- If you choose Supabase later, fill the `NEXT_PUBLIC_SUPABASE_*` and `SUPABASE_*` entries.

That single key powers both:

- `/api/transcribe`
- `/api/realtime-session`

For Vercel, add the same variable in the project environment settings. Keep the secret server-side only.

## Data Platform Options

The app is prepared for either backend path:

- `firebase/` for Firestore + Storage + Auth
- `supabase/` for Postgres + Auth + Storage + Realtime
- `NEXT_PUBLIC_STORAGE_PROVIDER` or `STORAGE_PROVIDER` can be used later to select the active backend

Recommended default for this app:

- Use Firebase as the source of truth.
- If you later need Supabase, sync from Firebase through jobs, webhooks, or an event pipeline.
- Avoid dual-writes unless you have a specific sync pipeline and a clear ownership model.

## Notes on live mode

- Live mode is realtime WebRTC-based
- Microphone capture requires a secure context
- The browser must support `RTCPeerConnection` and microphone permissions
- If the realtime route fails, the upload/record flow is still available as the fallback path
- Speaker diarization is best-effort and may fall back to standard transcription if the diarization model is unavailable

## Run

```bash
npm install
npm run dev
```

## Deployment prep

Before running a Vercel build:

1. Copy [`./.env.local.example`](./.env.local.example) to `.env.local`.
2. Set `OPENAI_API_KEY` locally.
3. Add `OPENAI_API_KEY` in Vercel environment variables.
4. Verify microphone permissions in the browser.
5. Smoke-test upload, record, and live mode once the app is deployed.

## Flow

1. Enter text, upload audio, or record a meeting.
2. Produce a transcript.
3. Generate meeting notes and key points.
4. Score Visual, Auditory, Kinesthetic, and Auditory Digital signals.
5. Export the combined report as Markdown or PDF.
