# Predicate Analyzer App

Standalone Next.js MVP for meeting transcription, summary extraction, and predicate analysis.

## What it does

- Upload audio or record a meeting
- Send the audio to the OpenAI transcription API
- Generate meeting notes, key points, timestamps, and action items
- Score Visual, Auditory, Kinesthetic, and Auditory Digital language
- Export the combined report as Markdown or print it to PDF

## Environment

Set `OPENAI_API_KEY` before running the app.

## Notes on live mode

- Live mode is chunked, not true sub-second streaming
- Very long meetings can accumulate latency if transcription takes longer than the chunk interval
- Microphone capture requires a secure context
- Speaker diarization is best-effort and may fall back to standard transcription if the diarization model is unavailable

## Run

```bash
npm install
npm run dev
```

## Flow

1. Enter text, upload audio, or record a meeting.
2. Produce a transcript.
3. Generate meeting notes and key points.
4. Score Visual, Auditory, Kinesthetic, and Auditory Digital signals.
5. Export the combined report as Markdown or PDF.
