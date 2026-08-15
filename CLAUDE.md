@AGENTS.md

# CLAUDE.md — Project Context for LABEL (Fantasy French Rap Platform)

This file is the persistent memory for this project. Read it fully before making changes. It captures the full design history, architecture, decisions, and open items so no context is lost between sessions.

---

## 1. What This Project Is

**One-line pitch:** A fantasy sports platform applied to French rap — users draft a roster of real artists ("build a virtual record label"), and scores move automatically based on real-world data (streaming growth, releases, chart movement), with a small manual layer for things no API can detect (viral moments, awards, controversy).

**Explicitly NOT:** a betting/gambling product. No cash entry fees, no cash payouts. Free-to-play, monetization (not yet built) would come from cosmetics/subscriptions/season passes — never wagering.

**Target audience:** French rap fans. UI is in French. Draft-first onboarding, no email required (anonymous pseudo-based accounts via Supabase anonymous auth).

**Core design philosophy (stated repeatedly through the build):** "The draft is not the game. The draft creates emotional attachment. The actual game is: can I manage my label better than everyone else over time?" — this is the FPL-style thesis the whole design follows.

---

## 2. Tech Stack

- **Frontend/Backend:** Next.js 16 (App Router), React, Tailwind CSS
- **Database/Auth:** Supabase (Postgres + Auth + RLS)
- **Hosting:** Netlify (auto-deploys from GitHub on push)
- **Scheduled jobs:** Netlify Scheduled Functions (`netlify/functions/daily-sync.mjs`, runs twice daily via cron `0 8,20 * * *`)
- **External APIs integrated:** Spotify Web API, YouTube Data API v3, Deezer API, Google News RSS
- **Package manager:** npm

**Design system:** Vinyl-record/label aesthetic. CSS variables: `--bg`, `--surface`, `--gold` (gains), `--crimson` (losses), `--violet` (accent). Fonts: Anton (display), Manrope (body), JetBrains Mono (numbers).

---

## 3. Deployment Pipeline (how changes go live)

1. Edit code locally (now in VS Code with Claude Code, previously via zip files built in a sandbox and manually copied in via GitHub Desktop — that manual process is now obsolete).
2. Any new/changed SQL migration must be run manually in Supabase's SQL Editor by the user (no automated migration runner exists yet).
3. Commit + push to GitHub (`main` branch).
4. Netlify auto-detects the push and rebuilds.
5. Environment variables live in Netlify's dashboard (Project configuration → Environment variables), NOT in a committed `.env` file. Required variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (secret — used only by the scheduled function, bypasses RLS)
   - `SPOTIFY_CLIENT_ID`
   - `SPOTIFY_CLIENT_SECRET`
   - `YOUTUBE_API_KEY`
   - (Deezer and Google News RSS need NO API key — genuinely free/open endpoints)
   - `CURRENTS_API_KEY` was used briefly for news, then deliberately dropped (see §7) — Google News RSS replaced it, no key needed.

**All SQL migrations, in the order they must be run** (all live in `/supabase/`):
1. `schema.sql` — original schema: artists (12 seed), profiles, roster_entries, score_events, RLS policies
2. `migration-pillar1.sql` — cost/tier fields, 100-artist reseed, roster limit 5→7
3. `migration-pillar234.sql` — category-weighted scoring fields, seasons table, transfers/captain fields on profiles, Pick'em tables (predictions, prediction_picks), `user_totals` view (replaces old `leaderboard` view)
4. `migration-apis.sql` — spotify_id/youtube_channel_id mapping fields, artist_news table
5. `migration-releases.sql` — last_release_date/name, last_spotify_followers, last_youtube_subscribers, last_feature_date
6. `migration-radar.sql` — upcoming_releases table
7. `migration-value-check.sql` — trivial safety check, ensures `value` is seeded
8. `migration-deezer-awards.sql` — deezer_id + fan/rank tracking, milestones table, weekly_awards table

---

## 4. Game Design — Locked Rules (do not casually change these)

### Draft & Budget
- **Roster size:** 7 artists
- **Budget:** 100 "Label Points" (millions)
- **Artist pool:** 100 real French/francophone rap artists, tiered:
  - S (Superstar): 25-40M cost, ~16 artists
  - A (Established): 12-25M cost, ~24 artists
  - B (Rising): 5-12M cost, ~30 artists
  - C (Emerging): 1-5M cost, ~30 artists
- **Diversity rule:** roster must include at least 1 Tier B or C artist (prevents everyone drafting the same 7 superstars) — enforced client-side, not yet server-enforced (open item, see §9)
- Pool includes Belgian/Algerian francophone artists (Damso, Hamza, Roméo Elvis, Caballero & JeanJass, Soolking) — deliberate choice, matches how the real industry treats the francophone scene as one unit.

### Scoring Formula
Score = weighted composite, NOT flat point-adding:
- **Momentum: 40%** (Spotify popularity/followers, YouTube views/subscribers, Deezer fans — all automated)
- **Performance: 30%** (Deezer track rank — automated; official chart position — NOT automatable for free, stays 0 unless manually logged)
- **Activity: 20%** (new releases, features — automated via Spotify; tours/festivals/label deals — manual)
- **Culture: 10%** (viral moments, awards, controversy — 100% manual, NO free API exists anywhere for this, confirmed via research, permanent limitation not a gap)

Each artist has 4 stored subtotal columns (`momentum_score`, `performance_score`, `activity_score`, `culture_score`); `score` is the computed weighted sum, recalculated on every event.

### Engagement Rules
- **Captain:** pick 1 roster artist/week for 2x points (borrowed from FPL)
- **Transfers:** 1 free swap/week, banks up to 2 if unused, extra swaps cost a 4-point penalty (tracked via `profiles.free_transfers`, `last_transfer_refresh`, `penalty_points`)
- **Value vs Score:** two separate concepts. `score` = cumulative points earned. `value` = market price, fluctuates based on recent momentum (was a static stub = cost until v9; now genuinely dynamic, see §6)
- **Anti-dominance:** an artist scoring >2.5x the pool average gets only 60% credit on new positive events (prevents runaway leaders)
- **Event decay:** every category subtotal fades 3% per sync run (twice daily) unless reinforced by new real events — prevents permanently inflated scores from one-time events

### Formats
- **Season League** (primary/core format): 3-month seasons, rolling calendar quarters. `seasons` table exists, one active season seeded. Season RESET (locking final standings, archiving, starting new season) is NOT automated yet — manual admin action only, real open item.
- **Pick'em** (secondary format): quick A/B prediction contests, admin-created, user-voted, admin-resolved, awards `pickem_score` on `profiles`. Fully built and working, entirely manual (by design — user explicitly chose to curate these by hand rather than auto-generate from news).
- Formats explicitly rejected during design: weekly full-roster redraft (wrong cadence for music, no "game days" like sports), live synchronous Draft Night (descoped for complexity), head-to-head 1v1 brackets (no scheduled "games" to hang matchups on).

---

## 5. Database Schema Summary (current state after all migrations)

### `artists`
Core fields: id, slug, name, initials, color, score, cost, tier, value.
Category subtotals: momentum_score, performance_score, activity_score, culture_score.
API mapping: spotify_id, youtube_channel_id, deezer_id.
Sync tracking (all "last known value" fields used to compute deltas): last_spotify_popularity, last_spotify_followers, last_youtube_view_count, last_youtube_subscribers, last_deezer_fans, last_deezer_rank, last_release_date, last_release_name, last_feature_date, last_synced_at.

### `profiles`
id, username, captain_artist_id, free_transfers, last_transfer_refresh, penalty_points, pickem_score.

### `roster_entries`
user_id, artist_id — DB trigger enforces max 7 per user.

### `score_events`
Append-only log. Every score change, manual or automated, gets a row: artist_id, event_key, label (human-readable), delta, category, season_id, created_by (null for automated events), created_at. This is the single source of truth for "why did this score change" — surfaced directly to users on Roster/Radar pages.

### `seasons`
id, name, start_date, end_date, is_active.

### `predictions` / `prediction_picks`
Pick'em tables. predictions: question, option_a, option_b, artist_a_id/artist_b_id (optional links), correct_option, closes_at. prediction_picks: unique per (prediction_id, user_id).

### `artist_news`
title, url, source, published_at, artist_id, reviewed (boolean, for admin triage). Populated by Google News RSS (no key needed).

### `upcoming_releases`
Detected YouTube "Premiere" videos (scheduled, not yet public) — the genuine "announced but not out yet" signal. artist_id, title, scheduled_at, video_url.

### `milestones`
artist_id, threshold (50/100/250/500/1000/2000), reached_at. Unique constraint prevents re-firing. Fires a small +5 culture-category score event when crossed.

### `weekly_awards`
award_type, artist_id, week_start, value. Currently one award type: `most_momentum` (highest net score_events delta over trailing week). Upserted (one row per award per week, not a growing history).

### `user_totals` (view, replaces old `leaderboard` view)
Computes: base_score (sum of roster artist scores) + captain_bonus (captain's score counted again) - penalty_points = total_score. This is what the Leaderboard page actually queries.

---

## 6. What's Automated vs Manual (be precise about this — it's a recurring point of confusion)

**Fully automatic, zero admin input, twice daily, once an artist is mapped to Spotify/YouTube/Deezer IDs:**
- Spotify popularity delta → Momentum
- Spotify follower delta → Momentum
- YouTube view delta → Momentum
- YouTube subscriber delta → Momentum
- Deezer fan count delta → Momentum
- Deezer top-track rank delta → Performance (first automated Performance signal)
- New Spotify release detection (album/single) → Activity, real "boom" moment, logged with real release name
- New Spotify feature detection ("appears_on") → Activity
- YouTube upcoming Premiere detection → shown on Radar page as "coming soon," **NOT scored** (detected + displayed only; would need a small code change to become a scored Activity event)
- Google News RSS per artist → populates `artist_news`, shown as a badge count on Draft screen, review queue in Admin
- Milestone threshold crossing → small bonus + celebratory log entry
- Weekly "most momentum" award computation

**Requires one-time manual setup per artist (via Admin → "IDs API" section):**
- Linking an artist to their real Spotify ID (search + click to assign)
- Linking to their real YouTube channel ID (search + click to assign)
- Deezer ID is auto-discovered on first sync (searches by artist name, takes first match) — no manual step, BUT this is less accurate than the human-confirmed Spotify/YouTube mapping and can silently mis-match short/common names. Adding a Deezer confirm step in Admin is a real improvement (see §9).

**Permanently manual, no free API exists anywhere (confirmed via research):**
- Official chart position (SNEP/French official charts — no free API)
- True stream counts (Spotify keeps this private/paywalled)
- Culture category: viral moments, awards, controversy — no structured free data source exists for any of this, for any platform, confirmed after checking
- TikTok trends (Creative Center is an ad-dashboard, not a data API; TikTok's real Research API needs academic institution approval)
- Google Trends (no official API at all, only ToS-violating scrapers — deliberately not used)
- Songkick (confirmed: explicitly refuses API access for hobby/educational projects, requires a paid partnership agreement)
- Bandsintown (historically requires partnership approval, not a simple public key)

**Admin's manual scoring form** (`app/(dashboard)/admin/AdminForm.js` — "Moteur de scoring" section) still exists and is the correct tool for all Culture-category events and any Activity events an API can't catch (tour announcements, festival lineups, label signings).

---

## 7. Key Decisions & Why (so they don't get silently re-litigated)

- **No gambling mechanics, ever.** No cash entry, no cash payout. Explicitly compared against DraftKings/Sorare (which faced regulatory scrutiny) vs. ESPN Fantasy/Sleeper (free-to-play, monetize via subscriptions/cosmetics) — deliberately following the second model.
- **Anonymous pseudo-only auth, no email.** Draft-first onboarding: user picks artists BEFORE creating an account, then a pseudo (via Supabase anonymous sign-in) saves it. Zero friction by design. The dashboard/nav tabs (Roster, Draft, Radar, Pick'em, Classement, Admin) only appear AFTER login+profile exist; the landing page is the draft, with no tabs — this is intentional, not a bug.
- **Currents API (news) was integrated then deliberately removed.** User decided manual Pick'em question creation was preferable to an automated news feed; Currents API is a generic news aggregator (not music-specific) and had real relevance risk for short/generic artist names. Later replaced by Google News RSS for the `artist_news` table specifically (free, no key), but Pick'em question creation remains 100% manual by design, not by limitation.
- **French rap fantasy market research (via web search) directly informed design:**
  - FanLabel (real competitor, US market, Warner/Sony/UMG-backed) — copied their core loop (sign songs → real streams → points → leaderboard → tier progression), but fixed two of their documented failures: (1) they silently devalued a reward mid-season and users complained bitterly — our rule: never retroactively change reward economics; (2) their contests drifted from weekly to 3-4 weeks, killing the daily habit — our rule: protect contest cadence.
  - Sleeper's data (50 min/day engagement, driven by social/chat, not scoring mechanics) is why private leagues are flagged as the highest-priority Flesh feature once built.
  - Sorare's pricing complaints and UK/France gambling-regulator scrutiny is why we explicitly avoid pay-to-acquire "power" cards.
- **Chess industry research informed the artist pool size decision:** initially 12 artists felt too shallow (everyone drafts the same stars); French rap release cadence research (singles every 4-8 weeks per artist, Friday-heavy release days) showed that a bigger pool (50, later expanded to 100) creates emergent weekly movement even without a fixed "season calendar" like sports has.
- **Real bug found and fixed in `daily-sync.mjs` (v9):** `applyScoreEvent()` originally read from a stale `artist` object across multiple calls in the same sync run (e.g. popularity update + follower update for the same artist), causing the second call to silently overwrite the first's subtotal change instead of building on it. Fixed by mutating the in-memory `artist` object after each DB write within the function.

---

## 8. Build History / Version Log (chronological, for context on how we got here)

- **v1-v4:** Core Skeleton — Next.js + Supabase scaffold, real auth (later replaced with anonymous), artist DB (12→100), scoring engine (manual), roster/draft/leaderboard, budget system, Captain, transfers, Pick'em format.
- **v5:** First live API integration layer — Spotify + YouTube clients, Admin "ID Mapping" tool, Currents API news (later removed).
- **v6:** Automatic new-release detection (the "boom moment" — album announcement → real score spike).
- **v7:** Expanded automation — Spotify follower tracking, YouTube subscriber tracking, automatic feature ("appears_on") detection, sync frequency bumped to twice daily.
- **v8:** Release Radar page — upcoming YouTube Premieres ("coming soon") + recent activity feed, fan-friendly natural-language event labels (emoji + plain sentences instead of raw technical strings).
- **v9:** Event decay, anti-dominance dampening, genuinely dynamic `value` field (was a static stub, now really fluctuates), configurable `RULES` constants object, real bug fix (stale in-memory artist object across same-run events).
- **v10 (current, being built locally):** Deezer integration (fan count + first automated Performance signal via track rank, no API key needed), Google News RSS (replaces dropped Currents key, also no key needed), Milestones (round-number score thresholds, one-time celebratory bonus), Weekly Award ("most momentum this week," shown on Radar page). **NOT yet deployed to Netlify as of the 2026-08 session (see §12).**

---

## 9. Open Items / Backlog (Skeleton, Flesh, Skin — in priority order)

### Still Core/Skeleton (should probably come before Flesh)
- **Deploy v10** — the live site still runs a pre-v10 build (Spotify/YouTube momentum only; no Deezer, Radar, awards) and still has the draft bug (see §12). Deploying makes live match local, fixes the live draft, and activates the full engine.
- **Admin permission lock** — currently ANY logged-in user can access Admin and log scoring events / resolve Pick'em / assign API IDs. No `role` field exists yet. This is the single most urgent fix before any real public launch beyond friends.
- **Server-side enforcement of the diversity rule** (currently only checked client-side in Draft UI — a determined user could bypass it via direct API calls)
- **Deezer confirm step in Admin** — Deezer currently auto-matches by name (blind first-result); a manual confirm like Spotify/YouTube would prevent silent wrong matches.
- **Season reset automation** — closing a season, archiving final standings, generating a "season summary/trophy," starting a new season — currently would require manual DB intervention.
- **Rate-limiting on anonymous sign-up** — no protection against someone scripting many fake accounts.

### Flesh (retention/social layer, none built yet)
- Private leagues (invite-code based, scoped leaderboard + chat) — flagged repeatedly as the single highest-leverage next feature, based on Sleeper's real engagement data
- Creator leagues (public, brandable, hosted by an influencer)
- Push notifications (weekly recap, rank-change alerts, deadline reminders)
- Streaks / "you called it" badges
- Season archive/history page ("your 2026 Spring Label," best discovery, biggest value gain)
- Dynasty mode (keep 1-2 artists across season resets) — explicitly deferred to "season 3+" feature

### Skin (UI/UX polish)
- Score-reveal animation (a delay/flip moment instead of an instant flat number — the actual "variable reward" hook from the Hook Model discussion)
- Real mobile device testing (everything so far has been verified via desktop screenshots only)
- Shareable draft/roster card design (screenshot-worthy results screen)
- "How Scoring Works" explainer page (addresses trust/transparency questions raised during the FAQ pressure-test exercise)
- Custom domain (currently on a random Netlify subdomain)

### Data sources considered but not yet built (real, free, feasible) — see §13
- MusicBrainz (free, open) — highest-leverage: a free Activity/release source that would REMOVE the Spotify-Premium dependency for release detection
- Reddit API (genuine free buzz signal, needs user to register a Reddit app for client ID/secret) — the only semi-automated path to the otherwise-unsolvable Culture/Buzz category
- Individual French rap blog RSS feeds (Booska-P, Raplume, OKLM, etc.) — needs per-site manual verification of feed availability before building

---

## 10. Distribution / Growth Strategy (researched, not yet executed)

- **Underdog Fantasy's real playbook** (researched via search): growth comes from seeding micro-creators with referral codes and repeatable content formats ("$X → $Y" reveal, "worst feeling" reaction clips) — NOT from a polished branded company account. This is the model to copy for launch, not paid ads or a slick trailer.
- **The actual short-form content hook** identified early in this project: a card-flip/ticker-reveal moment showing an artist's value crashing or spiking in real time — this maps directly to the Radar page and event feed already built.
- **Chess/FPL research on audience size:** confirmed that virality concentrates around a narrow set of recognizable names (10-15), not deep rosters — this is why the 100-artist pool is deliberately tiered (S/A/B/C) rather than flat, and why Superstar-tier artists matter disproportionately for marketing even though the game mechanically rewards finding undervalued Tier B/C picks.

---

## 11. How to Talk About This Project (tone/framing notes)

- The user (Saman) is non-technical but deeply engaged in product/game design — he drives design decisions through first-principles reasoning and real research (chess industry, fantasy football history, music industry release cadence) rather than copying blindly. Explain technical steps simply, with analogies, step by step. He wants to understand what he is doing and the big picture, not just be handed commands.
- He explicitly values honesty about limitations over confident overclaiming — multiple times in this build, "let's verify that's actually free/real" caught things that looked promising on paper but weren't (Songkick, Google Trends, TikTok Creative Center all failed real verification).
- Prior sessions used a slow, screenshot-driven manual deployment process (GitHub Desktop + Finder) due to lack of direct local file access — this is now obsolete with Claude Code running directly in this repo. Don't suggest zip files or manual copy-paste workflows going forward.

---

## 12. Local Dev Setup + Live State (added 2026-08 session)

### Local preview workflow (now the primary way to build)
- **Node.js is installed** (v24) and **dependencies installed** (`npm install` done). Run the app locally with **`npm run dev`** → open **http://localhost:3000**. Hot-reloads on save.
- **`.env.local`** exists locally (git-ignored) holding the **Production** Supabase URL + anon key, so localhost reads the **real production database**. Optional Spotify/YouTube/service-role keys are commented out there — only needed if running the sync engine locally.
- **`.gitignore` was created** this session (the repo had NONE — `node_modules/`, `.env.local`, `.DS_Store` were all at risk of being committed). Now protected.
- **The scoring engine (`daily-sync.mjs`) NEVER runs on localhost** — it's a Netlify Scheduled Function that only runs on the deployed site (twice daily, 08:00 & 20:00 UTC). Local is for building UI/pages; the engine only "breathes" live. It CAN be triggered manually by running it locally with a small runner + all keys, but this wasn't done.

### ⚠️ CLAUDE.md is NOT committed — protect it
This file is an **uncommitted working-tree file**. During the 2026-08 session, dropping in a "v10 folder" **overwrote CLAUDE.md with a 1-line stub** and it was only recovered from the assistant's session memory. **Recommend committing CLAUDE.md to git** so a future file-drop can't silently destroy it. Also beware: dropping full-folder updates overwrites local-only fixes (it reverted the draft-bug fix once, see below).

### Draft bug (found + fixed locally, NOT yet deployed)
- **Bug:** `app/page.js` fetched artists with `.select("id, name, initials, color, score")` — missing `cost` and `tier`. Without `tier`, the diversity rule can never pass → the draft "Continuer" button is **permanently greyed out**; without `cost` the budget/stars don't render. **This bug is live on the deployed site.**
- **Fix:** change the select to `.select("id, name, initials, color, score, cost, tier")`. Applied locally. (Was reverted once by a v10 folder drop, then re-applied.)

### Live production state as of 2026-08-10
- **Supabase project:** `riaunmcjanczilyxjjag`. **All 8 migrations are now run** (the DB was previously only through `migration-pillar234`; this session ran apis → releases → radar → value-check → deezer-awards). Radar tables + Spotify/YouTube/Deezer ID columns now all exist.
- **Spotify API was broken (403 "Active premium subscription required for the owner of the app")** — Spotify's 2025 policy requires the app-owner account to hold active Premium. The original app's owner lost Premium. **Fixed by using the user's brother's Premium account** to create a new Spotify developer app; its Client ID/Secret were verified working (200) and put into Netlify env vars + redeployed. ⚠️ This ties Spotify to the brother keeping Premium — a borrowed dependency, not permanent. MusicBrainz is the free escape hatch (see §13).
- **19 of 100 artists mapped** to Spotify (17 also to YouTube). Mapped: 13 Block, Alonzo, Bigflo & Oli, Booba, Da Uzi, Damso, Gazo, Georgio (no YT), Gims (no YT), Hamza, Jul, Kaaris, Koba LaD, Lacrim, Maes, Nekfeu, Ninho, Niska, Ziak. Mapping is stored in the shared DB, so it applies to all versions (old live, local v10, future deploys) — never lost.
- **Robot status:** the deployed (pre-v10) engine will run on its normal schedule. First run = baseline (no movement), second run = first movement. Expect Momentum (Spotify/YouTube) to start moving within ~24h. Deezer/Performance/Radar won't move until v10 is deployed.

---

## 13. Data Source Strategy (categories × confirmed free sources)

Relevant scoring categories: **Momentum (40%), Performance (30%), Activity (20%), Culture/Buzz (10%)**. News is a feeder, not scored.

| Category | Confirmed free & working | Not viable |
|---|---|---|
| **Momentum** | Spotify (popularity, followers), YouTube (views, subs), Deezer (fan count) — **3 sources, resilient** | — |
| **Performance** | Deezer (track rank) — **1 source only** | Official charts/SNEP (no free API), true stream counts (Spotify private) |
| **Activity** | Spotify (new releases, "appears_on" features). YouTube Premieres are detected+shown on Radar but **NOT scored** — so scored Activity is **Spotify-only = fragile** | — |
| **Culture/Buzz** | **None** — confirmed no free API for viral/awards/controversy. Manual only. | Google Trends (no API), TikTok Creative Center (ad dashboard) |
| **News** (not scored) | Google News RSS (free, no key) | Currents API (dropped by choice); blog RSS (unverified) |
| **Live/Concerts** (not built) | — | Songkick (refuses hobby), Bandsintown (partnership), Setlist.fm (manual approval, past shows only) |
| **Metadata / Activity backup** (not built) | **MusicBrainz** (free, open) — identified, unbuilt | — |
| **Buzz** (not built) | **Reddit API** (free, needs own app registration) — identified, unbuilt | — |

**Summary:** Momentum fully solved + resilient. Performance solved but single-source (Deezer). Activity solved but single-source (Spotify) → **fragile, and tied to the borrowed Premium**. Culture/Buzz permanently unsolved for free. **MusicBrainz (free Activity source, kills the Spotify-Premium dependency) and Reddit (only path to Culture) are the two real free cards still on the table.** MusicBrainz is the higher-leverage next data-source build.

---

## 14. Launch-Prep Session (2026-08-12/13) — what was built, decided, and still pending

**Goal driving this phase:** get to seed users — maximize conversion, retention, referrals. Everything below is built LOCALLY (v10) against the shared PROD Supabase, so all DB migrations are already live; only the CODE is not yet deployed. There is a **visual roadmap artifact** ("LABEL — Launch Roadmap") the user keeps as a living tracker.

### Built this session (local, compiles clean, NOT yet deployed)
- **Admin lock (done).** New `is_admin` boolean on `profiles`. Helper `lib/supabase/admin.js` → `getAdminContext()` returns `{supabase, user, isAdmin}`. The `/admin` page and **all 7 admin/action API routes** (`admin/spotify-search`, `admin/youtube-search`, `admin/save-artist-ids`, `admin/mark-news-reviewed`, `score-event`, `pickem/create`, `pickem/resolve`) now require isAdmin (401 if not logged in, 403 if not admin). Non-admins get a friendly French "Espace équipe" message on `/admin` (not a silent redirect). **The Admin tab is hidden from non-admins** in `NavTabs` (layout passes `isAdmin`). Admins in DB: `Sj021` and `AJ010`. NOTE: this is APP-LAYER only — RLS is NOT yet tightened, so a determined user could still write via direct DB calls. **RLS hardening is a real pre-public-launch follow-up.**
- **Metrics/analytics (base done, funnel pending).** New `events` table (event_type, user_id, metadata jsonb, created_at); RLS: anyone can insert, only admins can select. `DraftOnboarding` logs `account_created` + `roster_drafted`. Admin has a **"Métriques" panel** (`MetricsPanel.js`) showing Comptes créés / Labels draftés / Captains choisis / Partages. **Still to build: the KPI funnel** (steps → % drop between steps → find bottleneck; the user will send a KPI list grouped by conversion/retention/referral/funnel). Funnels need a per-visitor id tagged on each step event (incl. pre-signup) + variant tag for A/B.
- **Artist faces everywhere (done).** New `image_url` column on artists. Shared `components/ArtistFace.js` (circular photo + initials-on-color fallback). Faces shown on: onboarding draft (square tiles), Roster/"Signature", Draft/"Artistes" list, Radar. Backfilled all 100 via `supabase/backfill-all-images.sql` (18 Spotify by id + 80 Deezer by name; **Fixpen Sniper** has no match → initials fallback). **Auto-fill wired into the sync engine**: `daily-sync.mjs` `getDeezerArtistStats` now also returns `picture`, and the sync sets `image_url` for any artist missing one → **new artists get a face automatically (Deezer by name), once v10 is deployed.** Mapping a Spotify id also auto-grabs the photo (`save-artist-ids` calls `getSpotifyArtistImage`). Legal note discussed: OK at seed scale if photos are unmodified + "Photos via Spotify/Deezer" credit; the real long-term risk is name/likeness of real artists — flagged as pre-launch.
- **Tabs renamed (done)** for clarity (label theme): `/roster` → **"Signature"** (your 7), `/draft` → **"Artistes"** (the pool of 100). Functions unchanged (standard fantasy convention kept); only labels changed. Draft = pick pool, Roster = your team.
- **Onboarding draft rebuilt (done)** in `app/DraftOnboarding.js`: grouped by tier (Superstars first, not alphabetical), one-tap tier filter pills, always-visible search, "Trop cher · reste XM" on unaffordable cards (no silent grey-out), reassurance lines ("tu pourras tout changer après"), and two blank-page-killer shortcuts — **"✨ Équipe surprise"** (full random valid roster) and **"🪄 Complète pour moi"** (fills remaining slots) via module fn `buildRoster()` (respects 100M budget + ≥1 Tier B/C diversity). Sticky budget bar + single-tap add/remove kept.

### Key decisions locked this session
- **Auth model: pseudo-first, email optional-after.** Flow = Draft → Pseudo (account created = commitment, Supabase anonymous auth, zero friction, max conversion) → later offer Email as "ultimate save / protège ton label" (optional). Email's ONLY job here = **account recovery + cross-device** (the anonymous account is otherwise trapped in one browser and lost if cookies cleared). Supabase can upgrade the anon account with an email — same `user_id`, same data. **Do NOT gate signup behind email.**
- **Notifications = web push, NOT email.** User explicitly does not want to email news. Notifications will come from browser/web push (free, permission-based; iOS needs add-to-home-screen PWA). So email ≠ notification channel; email = save/recovery only.
- **No fake accounts / fake social proof.** User asked about seeding fake users; declined (deceptive, against the project's honesty ethos, FTC risk). Honest alternatives to avoid "empty app" feel: labeled demo/CPU players (transparent), "be the first" states, lead with the live Radar (real data moves), private leagues (real social proof from friends), seed 10-20 real users.

### Immediate next steps (the finish line before deploy, in the user's words: "onboarding + private leagues + metrics, then we're good")
1. **Onboarding — the common account-creation base** (shared by all A/B variants). Build the pseudo-first flow that MAXIMIZES account creation; email as optional post-draft "save". Then build **multiple onboarding variants** for A/B testing (user will design/describe them). A/B = instant in-code random split (zero delay), each step fires a tracked event tagged with variant + visitor id → per-variant funnel; can pinpoint which page loses people.
2. **Private leagues** (biggest build; MVP scope AGREED): create a league (name) → shareable invite code/link → join via code → league page with a **scoped leaderboard** (members only) → share button. **Chat = v2.** Was about to start when the session pivoted.
3. **Metrics KPI funnel** (needs the user's KPI list, grouped by category). Turn the events logbook into a funnel with % drop between steps + benchmark targets shown as %.
4. **Then DEPLOY v10** (commit → push main → Netlify builds). DB already migrated, so deploy is low-risk and unlocks: live faces, safe admin, better onboarding, real metrics, fixes the live draft bug, activates auto-face-fill + full v10 engine. Also worth committing CLAUDE.md + `.gitignore` (see §12).

### Mirror-to-Artistes-tab (small pending)
The in-app **"Artistes"** tab (`draft/DraftList.js`) should get the same search + tier pills + grouping + "Trop cher · reste XM" as the onboarding draft (it already sorts by tier and has faces). Not yet done.
