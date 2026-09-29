# Time Stride

Time Stride is a dual-layer time tracker: plan your day, log what actually
happened, and see the gap between the two. Every event lives on one of two
tracks side by side on the calendar — **Planned** (what you intend to do) and
**Actual** (what really happened) — so Analytics can compare them directly.

## Getting started

Copy `.env.example` to `.env` and fill in:
- `DATABASE_URL` / `DIRECT_URL` — a [Neon](https://neon.tech) Postgres
  project (pooled vs. direct connection — see the comments in
  `.env.example`). This is the app's only data store.
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — a
  [Supabase](https://supabase.com) project (`Settings → API Keys`), used for
  sign-in only; no app data lives there.

In that Supabase project's `Authentication → URL Configuration`, add
`http://localhost:3000/**` to Redirect URLs (and the same origin as Site
URL) so the sign-in flow can complete.

```bash
npm install
npm run db:migrate   # applies the Prisma schema to your database
npm run db:seed      # populates the default categories and the owner user
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), then sign up at
`/signup` and confirm via the email Supabase sends. Signing up with the
same address `npm run db:seed` seeded for the owner (see `prisma/seed.ts`)
links to that pre-seeded user — and any data already attached to it —
instead of creating a second account.

Other useful scripts: `npm run db:studio` (browse the database),
`npm run typecheck`, `npm run lint`.

## Features & how to use them

### Signing in
Sign up at `/signup` with a name, email, and password, then confirm via the
link Supabase emails you. Returning visits use `/login` with that email and
password. All app data (categories, events) stays in Neon regardless of
who's signed in — Supabase only handles the session.

### Calendar (Day / Week / Month / Year)
Switch views from the toolbar. Click any empty slot to create an event, or
click an existing block to edit it. Drag a block to move it, or drag its top
or bottom edge to resize it. The **Year** view shows a heatmap of daily plan
adherence.

### Creating an event
- **Planned vs Actual** — pick the tab at the top of the dialog.
- **Time fields** — 24-hour format only. Type a time directly (`9:30`,
  `930`, or `09.30` all work) or click the clock icon for a dropdown of
  5-minute increments (`10:00`, `10:05`, `10:10`, …).
- **Category, title, notes** — as usual.

### Repeating events
Set **Repeats** to:
- **Weekly on selected days** — tap the Mon–Sun circles for the days you
  want (e.g. Tue/Thu/Sat).
- **Every few days** — pick an interval, e.g. every 3 days.
- **Monthly** — repeats on the same date each month.
- **Advanced (RRULE)** — for anything else, paste a raw iCal RRULE.

A plain-language preview ("Repeats: every week on Tuesday, Thursday...")
confirms what you've set before you save.

### Skipping or editing a single occurrence
Open any occurrence of a repeating event and choose:
- **Just this occurrence** — Delete becomes "Skip occurrence" (removes only
  that date) and Save updates only that date's time/details, leaving every
  other occurrence — past and future — untouched.
- **Entire series** — Save/Delete apply to the whole recurring event, as
  before.

### Logging actual time
On a planned event you have two ways to record what really happened:
- **Log Actual Time** — reopens the dialog pre-filled as an Actual copy of
  the planned entry (same title, category, and times), which you can adjust
  and save immediately — no timer needed.
- **Start Timer** — starts the floating live stopwatch, pre-filled from the
  planned event; hit **Stop & Save** when you're done to commit the actual
  duration.

### Categories
Manage categories (name, color, icon) from the **Categories** page. Defaults
are seeded by `npm run db:seed`; you can add your own alongside them.

### Analytics
The **Analytics** page compares Planned vs Actual time over a date range:
per-category donut charts, a variance bar chart, adherence-score KPI cards,
and plain-language insight alerts (e.g. "Underestimated Work by 3.5 hrs").

## Tech stack

Next.js (App Router) · TypeScript · Prisma + PostgreSQL (Neon) · Supabase
Auth · Tailwind CSS + shadcn/ui · Zustand · rrule · Recharts.
