// Netlify Scheduled Function — runs daily (see config.schedule below).
// Automates the Momentum category (Spotify popularity + YouTube view growth)
// and fetches recent news per artist for the Admin review queue.
//
// Required environment variables (set in Netlify > Site settings > Environment variables):
//   NEXT_PUBLIC_SUPABASE_URL       (already set for the app)
//   SUPABASE_SERVICE_ROLE_KEY      (NEW — from Supabase > Project Settings > API > service_role)
//   SPOTIFY_CLIENT_ID
//   SPOTIFY_CLIENT_SECRET
//   YOUTUBE_API_KEY
//   CURRENTS_API_KEY
//
// This function bypasses RLS using the service_role key since it runs
// with no logged-in user — never expose that key to the browser/client.

import { createClient } from "@supabase/supabase-js";

async function getSpotifyToken() {
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
  if (!res.ok) throw new Error(`Spotify auth failed: ${res.status}`);
  const data = await res.json();
  return data.access_token;
}

async function getSpotifyPopularity(token, spotifyId) {
  const res = await fetch(`https://api.spotify.com/v1/artists/${spotifyId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.popularity ?? null;
}

async function getYoutubeViews(channelId) {
  const url = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelId}&key=${process.env.YOUTUBE_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const stats = data.items?.[0]?.statistics;
  return stats ? Number(stats.viewCount || 0) : null;
}

async function getArtistNews(name) {
  const url = `https://api.currentsapi.services/v1/search?keywords=${encodeURIComponent(
    name
  )}&language=fr&apiKey=${process.env.CURRENTS_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.news || []).slice(0, 5).map((n) => ({
    title: n.title,
    url: n.url,
    source: n.author || (n.category && n.category[0]) || null,
    published_at: n.published || null,
  }));
}

async function applyScoreEvent(supabase, artist, category, delta, label, eventKey) {
  if (delta === 0) return;

  const field = `${category}_score`;
  const newSubtotal = (artist[field] || 0) + delta;

  const subtotals = {
    momentum_score: artist.momentum_score || 0,
    performance_score: artist.performance_score || 0,
    activity_score: artist.activity_score || 0,
    culture_score: artist.culture_score || 0,
    [field]: newSubtotal,
  };

  const weighted = Math.round(
    subtotals.momentum_score * 0.4 +
      subtotals.performance_score * 0.3 +
      subtotals.activity_score * 0.2 +
      subtotals.culture_score * 0.1
  );

  await supabase
    .from("artists")
    .update({ ...subtotals, score: weighted })
    .eq("id", artist.id);

  const { data: activeSeason } = await supabase
    .from("seasons")
    .select("id")
    .eq("is_active", true)
    .single();

  await supabase.from("score_events").insert({
    artist_id: artist.id,
    event_key: eventKey,
    label,
    delta,
    category,
    season_id: activeSeason?.id || null,
    created_by: null, // automated, no admin user
  });
}

export default async () => {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: artists, error } = await supabase
    .from("artists")
    .select(
      "id, name, spotify_id, youtube_channel_id, momentum_score, performance_score, activity_score, culture_score, last_spotify_popularity, last_youtube_view_count"
    );

  if (error) {
    console.error("Failed to load artists:", error.message);
    return new Response("Failed", { status: 500 });
  }

  let spotifyToken = null;
  try {
    spotifyToken = await getSpotifyToken();
  } catch (e) {
    console.error("Spotify auth failed, skipping Spotify sync:", e.message);
  }

  const results = { spotifySynced: 0, youtubeSynced: 0, newsFound: 0, errors: [] };

  for (const artist of artists) {
    try {
      // --- Spotify popularity -> Momentum ---
      if (spotifyToken && artist.spotify_id) {
        const popularity = await getSpotifyPopularity(spotifyToken, artist.spotify_id);
        if (popularity !== null) {
          if (artist.last_spotify_popularity !== null && artist.last_spotify_popularity !== undefined) {
            const delta = popularity - artist.last_spotify_popularity;
            if (delta !== 0) {
              await applyScoreEvent(
                supabase,
                artist,
                "momentum",
                delta,
                `Spotify popularity ${delta > 0 ? "+" : ""}${delta}`,
                "stream_tick"
              );
              results.spotifySynced++;
            }
          }
          await supabase
            .from("artists")
            .update({ last_spotify_popularity: popularity, last_synced_at: new Date().toISOString() })
            .eq("id", artist.id);
        }
      }

      // --- YouTube view growth -> Momentum ---
      if (artist.youtube_channel_id) {
        const viewCount = await getYoutubeViews(artist.youtube_channel_id);
        if (viewCount !== null) {
          if (artist.last_youtube_view_count) {
            const rawDelta = viewCount - artist.last_youtube_view_count;
            const scaledDelta = Math.max(-10, Math.min(10, Math.round(rawDelta / 100000)));
            if (scaledDelta !== 0) {
              await applyScoreEvent(
                supabase,
                artist,
                "momentum",
                scaledDelta,
                `YouTube views ${scaledDelta > 0 ? "+" : ""}${scaledDelta}`,
                "view_spike"
              );
              results.youtubeSynced++;
            }
          }
          await supabase
            .from("artists")
            .update({ last_youtube_view_count: viewCount, last_synced_at: new Date().toISOString() })
            .eq("id", artist.id);
        }
      }

      // --- News ---
      if (process.env.CURRENTS_API_KEY) {
        const articles = await getArtistNews(artist.name);
        for (const a of articles) {
          if (!a.url) continue;
          const { error: newsErr } = await supabase
            .from("artist_news")
            .insert({
              artist_id: artist.id,
              title: a.title,
              url: a.url,
              source: a.source,
              published_at: a.published_at,
            })
            .select()
            .single();
          if (!newsErr) results.newsFound++;
          // ON CONFLICT (artist_id, url) silently fails via unique constraint — fine, expected for repeats
        }
      }
    } catch (e) {
      results.errors.push(`${artist.name}: ${e.message}`);
    }
  }

  console.log("Daily sync complete:", JSON.stringify(results));
  return new Response(JSON.stringify(results), {
    headers: { "Content-Type": "application/json" },
  });
};

export const config = {
  schedule: "@daily",
};
