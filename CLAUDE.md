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

## Billing (Stripe)

Every user except `PAYWALL_EXEMPT_EMAILS` pays €9.90/month through a single
Stripe **Payment Link** (`NEXT_PUBLIC_STRIPE_PAYMENT_LINK`). The app never
creates prices or checkout sessions; it only mirrors the subscription's
status onto `User.subscriptionStatus`.

- The paywall lives in `getCurrentUserId()` (`src/lib/auth.ts`): no access
  (see `hasAccess`) → `redirect("/subscribe")`. Because every server action
  and dashboard page goes through it, nothing else needs gating.
  `getSignedInUser()` is the same lookup *without* the paywall — only for
  `/subscribe` and the billing portal action, which unpaid users must reach.
- `/subscribe` appends `client_reference_id=<User.id>` to the Payment Link;
  that is how a payment is tied back to a user.
- The Payment Link redirects to `/subscribe/success?session_id=...`, which
  syncs immediately so the user doesn't wait on the webhook.
- `/api/stripe/webhook` (let through by `src/lib/supabase/proxy.ts` with no
  session; authenticated by signature only) handles
  `checkout.session.completed` and `customer.subscription.updated|deleted`.
  This is the only way cancellations and failed renewals revoke access.
- Stripe objects live in the test-mode sandbox **"TimeStripe sandbox"**
  (`acct_1UJakH…`, the account `STRIPE_SECRET_KEY` belongs to): product
  "Time Stride", €9.90/month price, a Customer Portal configuration, a
  webhook endpoint for `https://time-stride.vercel.app/api/stripe/webhook`,
  and **two Payment Links** that differ only in where they send the user
  after paying (a Payment Link has exactly one redirect URL):
  - local `.env`: `https://buy.stripe.com/test_8x24gy3EjdLHfQn7SN4F200` →
    `http://localhost:3000/subscribe/success`
  - Vercel: `https://buy.stripe.com/test_00wdR82Af22Z33Bb4Z4F201` →
    `https://time-stride.vercel.app/subscribe/success`
- The Stripe MCP server may be connected to a *different* account
  ("TimeStripe", `acct_1ULMCx…`, which only holds unused leftovers). Check
  `list_available_accounts_or_orgs` against the key's account before using
  it; otherwise call Stripe with the `.env` key from a Node script.
- Locally, the webhook can't reach `localhost` without the Stripe CLI
  (`stripe listen --forward-to localhost:3000/api/stripe/webhook`), so
  cancellations only sync on the deployed site. Checkout itself doesn't
  need the webhook — `/subscribe/success` syncs directly.
- Env: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (secrets),
  `NEXT_PUBLIC_STRIPE_PAYMENT_LINK`, `PAYWALL_EXEMPT_EMAILS`.

## Database migrations

The Neon database in `.env` holds real data (likely the same one Vercel
uses). `prisma migrate dev` is interactive and won't run from a
non-interactive shell. **Never** work around that by pointing
`--shadow-database-url` at `DATABASE_URL`/`DIRECT_URL`: Prisma wipes the
shadow database, and it wiped this one once (restored via Neon's
point-in-time restore). Instead, write the migration SQL into a new
`prisma/migrations/<timestamp>_<name>/migration.sql` and apply it with
`npx prisma migrate deploy`, which only runs pending migrations.

### Known follow-ups (not urgent, tracked here so they aren't re-discovered)
- No password-reset flow yet.
- Supabase's shared email service is rate-limited and not meant for
  production; set up custom SMTP before relying on this for anyone but the
  owner.
- EU VAT (Stripe Tax) is not configured; €9.90 is charged flat.
- Stripe is test mode only; going live means recreating the product,
  Payment Link, portal config and webhook in live mode and swapping keys.
