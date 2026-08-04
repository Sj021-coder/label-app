# LABEL — Fantasy Rap Platform (Skeleton)

A real Next.js + Supabase app implementing the four Phase 1 core functions:
1. **Artist database** (`artists` table, seeded with 12 curated French rap names)
2. **Scoring engine** (`/admin` page + `/api/score-event` route — manual v1, matches `scoring-rule-sheet-v0.1.md`)
3. **User account + roster** (real Supabase Auth signup/login + `roster_entries` table, max 5, enforced by a DB trigger)
4. **Leaderboard** (SQL view summing each user's roster scores)

---

## 1. Create your Supabase project (5 min)

1. Go to https://supabase.com → New project (free tier is enough).
2. Once created, go to **Project Settings → API**. Copy:
   - `Project URL`
   - `anon public` key
3. Go to **SQL Editor → New query**, paste the entire contents of `supabase/schema.sql`, and run it.
   This creates all 4 tables, the leaderboard view, row-level security policies, and seeds the 12 artists.

## 2. Configure local env

```bash
cp .env.local.example .env.local
```
Paste your Project URL and anon key into `.env.local`.

## 3. Run it

```bash
npm install
npm run dev
```
Open http://localhost:3000 — you'll land on `/login`. Sign up with any email/password (Supabase's default email confirmation may be ON — for a personal/friends test, go to **Authentication → Providers → Email** in Supabase and turn "Confirm email" OFF so signup is instant).

## 4. How to use it day to day

- **Sign up** → choose a label name (this is your public username on the leaderboard).
- **Draft** → add up to 5 artists to your roster.
- **Admin** → this is your manual scoring engine. When something real happens (a chart entry, a viral moment, an award), pick the artist + event type and hit Apply. This is exactly the "log real events, apply a point rule" mechanism from the ruleset.
- **Roster** → shows your 5 artists, current scores, and a feed of recent events affecting them.
- **Leaderboard** → global ranking of everyone who's signed up.

## 5. Deploy it for real (so friends can use it from their phones)

1. Push this folder to a GitHub repo.
2. Go to https://vercel.com → New Project → import the repo.
3. Add the same two env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) in Vercel's project settings.
4. Deploy. You'll get a real URL you can send to your 10 test friends.

## 6. What's intentionally NOT built yet (per the build plan)

- No Spotify/YouTube API automation — Category A of the scoring sheet is still manual for now, same as Category B/C. Wire this in once the manual loop is proven.
- No private leagues, chat, notifications, or streaks — that's Phase 2 (Flesh), only build it once people are actually using this daily.
- The `/admin` page has no extra permission check beyond "logged in" — anyone with an account can log scoring events right now. Fine for a closed friends test; add a `role` column to `profiles` and check it in the API routes before opening this to the public.

## Project structure

```
app/
  login/            → signup/login
  onboarding/        → set label username after signup
  (dashboard)/
    layout.js         → auth guard + header + tabs, shared by all 4 core pages
    roster/            → your 5 artists + recent events
    draft/              → browse/add/remove artists
    leaderboard/         → global ranking
    admin/                → the scoring engine
  api/
    roster/route.js      → add/remove artist from roster
    score-event/route.js  → apply a scoring event (writes score_events + updates artists.score)
lib/
  scoringEvents.js   → single source of truth for event → point values (mirrors scoring-rule-sheet-v0.1.md)
  supabase/           → browser + server Supabase clients
supabase/
  schema.sql           → run this once in Supabase SQL Editor
```
