@AGENTS.md

## Authentication

Auth is Supabase Auth (email + password); all app data stays in Neon/Prisma,
untouched by auth — Supabase only issues the session cookie.

- `getCurrentUserId()` in `src/lib/auth.ts` is the single seam between the
  app and "who is the current user" — every server action calls it. It reads
  the Supabase session, then finds-or-creates the matching Prisma `User` row
  by email. The pre-seeded owner row (`prisma/seed.ts`) is found by email on
  first login rather than duplicated, so existing events stay attached.
- `src/proxy.ts` (not `middleware.ts` — see the Next 16 note above; it lives
  under `src/` because `app/` is under `src/app`) refreshes the session
  cookie on every request and redirects signed-out visitors to `/login`.
- `/auth/confirm` (`src/app/auth/confirm/route.ts`) handles the sign-up
  confirmation link. It accepts **both** a PKCE `code` and a `token_hash` +
  `type` pair, because which one arrives depends on Supabase project config,
  not on this app:
  - `code` — what Supabase's *default* email templates send. This project
    currently runs on Supabase's shared (no custom SMTP) email service,
    which only supports default templates — see "Known follow-ups" below.
  - `token_hash` + `type` — what a template customised to link straight to
    this route would send instead (no same-browser requirement, unlike the
    PKCE `code` path).
- Required env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  (see `.env.example`). Both are meant to be public — the anon/publishable
  key carries no privilege; every server action still scopes queries by
  `userId` from `getCurrentUserId()`.
- Supabase project's `Authentication → URL Configuration` must list every
  deployment origin that needs to complete sign-in (`localhost:3000`, the
  Vercel production domain — not a preview-deployment URL, which is random
  per-build and sits behind Vercel's own SSO wall) under both Site URL and
  Redirect URLs.

### Known follow-ups (not urgent, tracked here so they aren't re-discovered)
- No password-reset flow yet.
- Supabase's shared email service is rate-limited and not meant for
  production; set up custom SMTP before relying on this for anyone but the
  owner.
- Signup is currently open to any email, not restricted to the owner.
