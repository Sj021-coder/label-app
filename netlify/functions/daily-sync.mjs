// Cron trigger ONLY — twice daily (see config.schedule below). All the real
// work (Spotify/YouTube/Deezer/MusicBrainz/kworb/News, every source, same
// as before) lives in `daily-sync-worker.mjs`, which now runs as a Netlify
// BACKGROUND Function instead of a Scheduled Function.
//
// WHY THIS SPLIT EXISTS (2026-09-02): Scheduled Functions are hard-capped
// at 30-60s. As the engine grew, a real run started hitting that ceiling
// and getting killed mid-work (confirmed live: Netlify's logs showed an
// exact `Duration: 60000ms` with no completion, twice). That 60-second
// limit was never an actual product requirement — it was an artifact of
// the mechanism this was first built on. Netlify's Scheduled and
// Background function types can't be combined directly, so the standard
// pattern (and the one used here) is: a tiny Scheduled Function that only
// wakes up a Background Function, which does the real work with up to 15
// minutes instead of one. Nothing about WHAT the engine does changed —
// every data source, every artist, every rule is identical. Only the time
// budget changed.
//
// Required environment variable (NEW, in addition to everything
// daily-sync-worker.mjs needs):
//   SYNC_TRIGGER_SECRET   any long random string — must be the exact same
//                         value in Netlify's env vars as the worker reads.
//                         Proves this call actually came from our own cron,
//                         not a stranger who found the worker's URL.

export default async () => {
  const siteUrl = process.env.URL; // Netlify's own env var for the site's real production URL
  if (!siteUrl) {
    console.error("daily-sync trigger: process.env.URL is not set, cannot reach the worker");
    return new Response("Missing site URL", { status: 500 });
  }
  if (!process.env.SYNC_TRIGGER_SECRET) {
    console.error("daily-sync trigger: SYNC_TRIGGER_SECRET is not set — refusing to trigger an unprotected worker");
    return new Response("Missing secret", { status: 500 });
  }

  try {
    // Fire-and-forget on purpose: a Background Function responds 202
    // immediately and keeps running after that, so this trigger doesn't
    // wait for the real work to finish (and shouldn't — it has its own
    // 30-60s budget just to make this one call).
    await fetch(`${siteUrl}/.netlify/functions/daily-sync-worker`, {
      method: "POST",
      headers: { "x-sync-secret": process.env.SYNC_TRIGGER_SECRET },
    });
    console.log("daily-sync trigger: worker invoked");
    return new Response("Worker triggered", { status: 200 });
  } catch (e) {
    console.error("daily-sync trigger: failed to invoke worker:", e.message);
    return new Response(`Failed to trigger worker: ${e.message}`, { status: 500 });
  }
};

export const config = {
  schedule: "0 8,20 * * *", // twice daily: 8am and 8pm UTC
};
