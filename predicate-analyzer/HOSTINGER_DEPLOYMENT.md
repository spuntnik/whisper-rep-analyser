# Hostinger Deployment Guide

This app is designed to be deployed as its own Node.js web app from the `predicate-analyzer/` folder.

## App root

- Deploy the contents of `predicate-analyzer/` as the project root
- The app is a Next.js Node.js app with API routes for transcription and realtime session minting
- `next.config.ts` is set to standalone output for a cleaner server bundle

## Recommended Hostinger settings

- App type: Node.js Web App
- Framework: Next.js
- Node version: 22.x or 24.x
- Build command: `npm run build`
- Start command: `npm run start`

## Environment variables

Use [`./.env.hostinger.example`](./.env.hostinger.example) as the source for the deployment env set.

Required now for `dealiq.mindscoach.com`:

- `NEXT_PUBLIC_APP_URL=https://dealiq.mindscoach.com`
- `OPENAI_API_KEY`
- `NEXT_PUBLIC_STORAGE_PROVIDER=firebase`
- `STORAGE_PROVIDER=firebase`
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

Optional later:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL`

## Domain

Connect `dealiq.mindscoach.com` in Hostinger after the Node.js app is created.

If DNS is outside Hostinger:

- point the subdomain according to Hostinger’s custom-domain flow
- wait for SSL and propagation

## Why this setup

- Uploads and live transcription need Node.js API routes
- The app is not a static export
- Firebase stays the source of truth for data
- Supabase can be added later as a downstream mirror if needed
