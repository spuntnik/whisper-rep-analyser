# Predicate Analyzer App

Standalone Next.js MVP for meeting transcription, summary extraction, and predicate analysis.

The current voice capture uses browser speech recognition as the front-end input path. The
workflow and API are structured so Whisper-backed transcription can be dropped in next.

## Run

```bash
npm install
npm run dev
```

## Flow

1. Enter text or capture voice.
2. Produce a cleaned transcript.
3. Generate meeting notes and key points.
4. Score Visual, Auditory, Kinesthetic, and Auditory Digital signals.
5. Show channel percentages, buying channel, and phrase suggestions.
