# Supabase Layout

This folder is the Supabase-ready side of the app.

Recommended role:

- Supabase can be used later as a downstream mirror or analytics store
- Do not treat it as a second primary writer if Firebase is the source of truth

## Recommended environment variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL`

## Core tables

- `meetings`
- `transcript_segments`
- `action_items`
- `analysis_results`

## Notes

- Use Postgres as the source of truth.
- Use RLS with `owner_id` as the ownership field.
- Keep audio storage in Supabase Storage if you want uploads managed alongside records.
