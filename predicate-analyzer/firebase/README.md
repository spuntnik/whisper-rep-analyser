# Firebase Layout

This folder is the Firebase-ready side of the app.

Recommended role:

- Firebase is the source of truth for app data
- Any Supabase usage later should be treated as downstream sync or read replica, not the primary writer

## Recommended environment variables

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

## Suggested structure

- `meetings/{meetingId}`
- `meetings/{meetingId}/segments/{segmentId}`
- `meetings/{meetingId}/analysis/{analysisId}`
- `meetings/{meetingId}/actionItems/{actionItemId}`
- `users/{uid}`

## Notes

- Use Firestore as the primary metadata store.
- Use Cloud Storage for audio uploads and exported files.
- Keep OpenAI API calls server-side in the Next.js app or Firebase Functions.
- If Supabase is added later, feed it from an event pipeline rather than writing to both systems directly.
