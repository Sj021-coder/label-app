// TEMPORARY diagnostic function — not part of the engine, safe to delete
// once the real cause of the 403/400/429 Spotify errors is found.
//
// Isolates exactly which step is failing, one at a time, so we know the
// real cause instead of guessing:
//   1. Token fetch — is the Client ID/Secret itself valid?
//   2. Single-artist fetch, one known-good artist — does basic auth even work?
//   3. Bulk multi-artist fetch, that SAME single ID — is the bulk endpoint
//      itself the problem, separate from auth?
//   4. Releases fetch, that SAME artist — reproduces the specific 400 seen
//      in production.
//
// Protected by the same shared secret as daily-sync-worker so this isn't
// a free public way to burn our Spotify quota either.
import { createClient } from "@supabase/supabase-js";

export default async (req) => {
  const providedSecret = req.headers.get("x-sync-secret");
  if (!process.env.SYNC_TRIGGER_SECRET || providedSecret !== process.env.SYNC_TRIGGER_SECRET) {
    return new Response("Forbidden", { status: 403 });
  }

  const out = { steps: [] };

  // Step 1: token
  let token = null;
  try {
    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization:
          "Basic " +
          Buffer.from(
            `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
          ).toString("base64"),
      },
      body: "grant_type=client_credentials",
    });
    const bodyText = await res.text();
    out.steps.push({ step: "token_fetch", status: res.status, ok: res.ok, body: bodyText.slice(0, 300) });
    if (res.ok) {
      token = JSON.parse(bodyText).access_token;
    }
  } catch (e) {
    out.steps.push({ step: "token_fetch", error: e.message });
  }

  if (!token) {
    out.conclusion = "Token fetch itself failed — the Client ID/Secret pair is the problem, not any specific endpoint.";
    return new Response(JSON.stringify(out, null, 2), { headers: { "Content-Type": "application/json" } });
  }

  // Get one known-good, currently-mapped artist straight from the DB
  // (not hardcoded — avoids relying on a possibly-stale remembered ID).
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: testArtist } = await supabase
    .from("artists")
    .select("id, name, spotify_id")
    .eq("name", "Ninho")
    .single();

  if (!testArtist?.spotify_id) {
    out.conclusion = "Could not find a test artist (Ninho) with a spotify_id to test against.";
    return new Response(JSON.stringify(out, null, 2), { headers: { "Content-Type": "application/json" } });
  }
  out.testArtist = testArtist;

  // Step 2: single-artist fetch
  try {
    const res = await fetch(`https://api.spotify.com/v1/artists/${testArtist.spotify_id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const bodyText = await res.text();
    out.steps.push({ step: "single_artist_fetch", status: res.status, ok: res.ok, body: bodyText.slice(0, 300) });
  } catch (e) {
    out.steps.push({ step: "single_artist_fetch", error: e.message });
  }

  // Step 3: bulk fetch with just this one ID
  try {
    const res = await fetch(`https://api.spotify.com/v1/artists?ids=${testArtist.spotify_id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const bodyText = await res.text();
    out.steps.push({ step: "bulk_artist_fetch_single_id", status: res.status, ok: res.ok, body: bodyText.slice(0, 300) });
  } catch (e) {
    out.steps.push({ step: "bulk_artist_fetch_single_id", error: e.message });
  }

  // Step 4: releases fetch (reproduces the specific 400 seen in production)
  try {
    const res = await fetch(
      `https://api.spotify.com/v1/artists/${testArtist.spotify_id}/albums?include_groups=album,single&limit=50&market=FR`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const bodyText = await res.text();
    out.steps.push({ step: "releases_fetch", status: res.status, ok: res.ok, body: bodyText.slice(0, 300) });
  } catch (e) {
    out.steps.push({ step: "releases_fetch", error: e.message });
  }

  // Step 5: bulk fetch with the FULL real list of every mapped artist —
  // reproduces the exact 403 seen in production, isolates whether it's a
  // batch-size/malformed-ID problem specific to the full list.
  const { data: allMapped } = await supabase.from("artists").select("spotify_id").not("spotify_id", "is", null);
  const allIds = (allMapped || []).map((a) => a.spotify_id);
  try {
    const res = await fetch(`https://api.spotify.com/v1/artists?ids=${allIds.slice(0, 50).join(",")}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const bodyText = await res.text();
    out.steps.push({
      step: "bulk_artist_fetch_full_first_50",
      idsCount: allIds.slice(0, 50).length,
      status: res.status,
      ok: res.ok,
      body: bodyText.slice(0, 500),
    });
  } catch (e) {
    out.steps.push({ step: "bulk_artist_fetch_full_first_50", error: e.message });
  }

  return new Response(JSON.stringify(out, null, 2), { headers: { "Content-Type": "application/json" } });
};
