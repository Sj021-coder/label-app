// Netlify Scheduled Function — runs twice daily (see config.schedule below).
// Fully automates Momentum (Spotify popularity + followers, YouTube views +
// subscribers) and Activity (new releases, new features) for any artist
// that's been mapped to a Spotify/YouTube ID — zero manual admin input
// needed once mapped. Culture (viral moments, awards, controversy) has no
// free automatic data source anywhere and stays manually logged, permanently.
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
import { TRANSFER_FREE_PER_WEEK, TRANSFER_BANK_CAP } from "../../lib/gameRules.js";

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

async function getSpotifyArtistData(token, spotifyId) {
  const res = await fetch(`https://api.spotify.com/v1/artists/${spotifyId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return { popularity: data.popularity ?? null, followers: data.followers?.total ?? null };
}

async function getLatestRelease(token, spotifyId) {
  const url = `https://api.spotify.com/v1/artists/${spotifyId}/albums?include_groups=album,single&limit=1&market=FR`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const data = await res.json();
  const latest = data.items?.[0];
  if (!latest) return null;
  return {
    name: latest.name,
    releaseDate: latest.release_date,
    type: latest.album_type,
  };
}

async function getLatestFeature(token, spotifyId) {
  // "appears_on" = tracks by OTHER artists that this artist is featured on
  const url = `https://api.spotify.com/v1/artists/${spotifyId}/albums?include_groups=appears_on&limit=1&market=FR`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const data = await res.json();
  const latest = data.items?.[0];
  if (!latest) return null;
  return { name: latest.name, releaseDate: latest.release_date, byArtist: latest.artists?.[0]?.name };
}

async function getYoutubeStats(channelId) {
  const url = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelId}&key=${process.env.YOUTUBE_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const stats = data.items?.[0]?.statistics;
  if (!stats) return null;
  return {
    viewCount: Number(stats.viewCount || 0),
    subscriberCount: Number(stats.subscriberCount || 0),
  };
}

async function getUpcomingPremieres(channelId) {
  // Finds scheduled "Premiere" videos — real artists use this to hype a
  // release before it's actually out. This is the genuine "announced/incoming" signal.
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&eventType=upcoming&type=video&maxResults=3&key=${process.env.YOUTUBE_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.items || []).map((item) => ({
    title: item.snippet.title,
    videoId: item.id.videoId,
    publishedAt: item.snippet.publishTime,
  }));
}

async function getArtistNews(name) {
  // Google News RSS — genuinely free, no API key needed at all.
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(
    name
  )}&hl=fr&gl=FR&ceid=FR:fr`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const xml = await res.text();

  // Lightweight manual parse — avoids adding an XML dependency for a
  // simple, predictable RSS structure.
  const items = [];
  const itemBlocks = xml.split("<item>").slice(1);
  for (const block of itemBlocks.slice(0, 5)) {
    const title = (block.match(/<title>(.*?)<\/title>/s) || [])[1];
    const link = (block.match(/<link>(.*?)<\/link>/s) || [])[1];
    const pubDate = (block.match(/<pubDate>(.*?)<\/pubDate>/s) || [])[1];
    const source = (block.match(/<source[^>]*>(.*?)<\/source>/s) || [])[1];
    if (title && link) {
      items.push({
        title: title.replace(/<!\[CDATA\[|\]\]>/g, "").trim(),
        url: link.trim(),
        source: source ? source.replace(/<!\[CDATA\[|\]\]>/g, "").trim() : "Google News",
        published_at: pubDate ? new Date(pubDate).toISOString() : null,
      });
    }
  }
  return items;
}

// --- Booska-P (French rap media) — a real, free, no-key RSS feed. ---
// This is the honest substitute for "Instagram rap-news accounts": those
// aren't reachable via any free API (Instagram doesn't expose arbitrary
// third-party accounts to outside apps), but Booska-P is one of the actual
// outlets that content like that is usually sourced from in the first place.
function parseRssItems(xml, max) {
  const items = [];
  const blocks = xml.split("<item>").slice(1);
  for (const block of blocks.slice(0, max)) {
    const title = (block.match(/<title>(.*?)<\/title>/s) || [])[1];
    const link = (block.match(/<link>(.*?)<\/link>/s) || [])[1];
    const pubDate = (block.match(/<pubDate>(.*?)<\/pubDate>/s) || [])[1];
    if (title && link) {
      items.push({
        title: title.replace(/<!\[CDATA\[|\]\]>/g, "").trim(),
        url: link.trim(),
        published_at: pubDate ? new Date(pubDate).toISOString() : null,
      });
    }
  }
  return items;
}

async function getBooskaPArtistNews(artistName) {
  // Booska-P's own search is fuzzy (verified: it returns loosely-related
  // results, not just exact matches — the same relevance risk that got
  // Currents API dropped). So we search, then keep only items whose TITLE
  // actually contains the artist's name — a cheap but real relevance filter.
  const url = `https://www.booska-p.com/?s=${encodeURIComponent(artistName)}&feed=rss2`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const xml = await res.text();
  const nameLc = artistName.toLowerCase();
  return parseRssItems(xml, 10)
    .filter((i) => i.title.toLowerCase().includes(nameLc))
    .slice(0, 3)
    .map((i) => ({ ...i, source: "Booska-P" }));
}

async function getGeneralRapNews() {
  // The site's whole feed, unfiltered — a general "actu rap" ticker, not
  // tied to any one artist. Feeds the Radar's holistic feel.
  const res = await fetch("https://www.booska-p.com/feed/");
  if (!res.ok) return [];
  const xml = await res.text();
  return parseRssItems(xml, 8).map((i) => ({ ...i, source: "Booska-P" }));
}

async function searchDeezerArtist(name) {
  // Deezer's public API needs NO authentication for search/artist endpoints.
  const url = `https://api.deezer.com/search/artist?q=${encodeURIComponent(name)}&limit=1`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const artist = data.data?.[0];
  if (!artist) return null;
  return { id: artist.id, name: artist.name, fans: artist.nb_fan };
}

async function getDeezerArtistStats(deezerId) {
  const res = await fetch(`https://api.deezer.com/artist/${deezerId}`);
  if (!res.ok) return null;
  const data = await res.json();
  return {
    fans: data.nb_fan ?? null,
    // Free artist photo, straight from Deezer — used to auto-fill faces.
    picture: data.picture_xl || data.picture_big || data.picture_medium || null,
  };
}

async function getDeezerTopTrackRank(deezerId) {
  // Deezer's "rank" field on a track is a real popularity score — the
  // closest free proxy we have to true chart performance.
  const res = await fetch(`https://api.deezer.com/artist/${deezerId}/top?limit=1`);
  if (!res.ok) return null;
  const data = await res.json();
  const track = data.data?.[0];
  return track ? { rank: track.rank, trackName: track.title } : null;
}

// ============================================================
// CONFIGURABLE RULES — tune these without touching the logic below
// ============================================================
const RULES = {
  DECAY_RATE: 0.03, // each category subtotal fades 3% per sync run if not reinforced
  DOMINANCE_THRESHOLD: 2.5, // an artist scoring 2.5x the pool average is "dominant"
  DOMINANCE_DAMPENING: 0.6, // dominant artists get only 60% of new positive points
  VALUE_SENSITIVITY: 50, // higher = value reacts less to a given score swing
  VALUE_MIN_MULTIPLIER: 0.3, // value can't fall below 30% of base cost
  VALUE_MAX_MULTIPLIER: 3.0, // value can't rise above 300% of base cost
};

// Explainability: turn "value went from 24M to 27M" into a real reason,
// never a black box. Picks whichever category moved the most this run and
// describes it in plain language — same categories the score is built from.
function buildValueReason(artist) {
  const catDeltas = {
    momentum: (artist.momentum_score || 0) - (artist._momentumAtRunStart || 0),
    performance: (artist.performance_score || 0) - (artist._performanceAtRunStart || 0),
    activity: (artist.activity_score || 0) - (artist._activityAtRunStart || 0),
    culture: (artist.culture_score || 0) - (artist._cultureAtRunStart || 0),
  };
  const labels = {
    momentum: { up: "🔥 Streams et abonnés en forte hausse", down: "📉 Streams et abonnés en baisse" },
    performance: { up: "📈 Classements Deezer en progression", down: "📉 Classements Deezer en recul" },
    activity: { up: "🎵 Nouvelle sortie ou feature récente", down: "🎵 Aucune sortie récente" },
    culture: { up: "🏆 Actu positive (jalon, award, buzz)", down: "⚠️ Actu négative" },
  };
  const entries = Object.entries(catDeltas)
    .filter(([, v]) => v !== 0)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  if (!entries.length) return null;
  const [cat, val] = entries[0];
  return labels[cat]?.[val > 0 ? "up" : "down"] || null;
}

async function applyScoreEvent(supabase, artist, category, delta, label, eventKey, poolAverage) {
  if (delta === 0) return 0;

  // Anti-dominance: artists already far above the pool average get less
  // benefit from new positive events — keeps one artist from running away
  // with the leaderboard purely from early momentum.
  let effectiveDelta = delta;
  if (delta > 0 && poolAverage && artist.score > poolAverage * RULES.DOMINANCE_THRESHOLD) {
    effectiveDelta = Math.round(delta * RULES.DOMINANCE_DAMPENING);
    if (effectiveDelta === 0) return 0;
  }

  const field = `${category}_score`;
  const newSubtotal = (artist[field] || 0) + effectiveDelta;

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

  // Mutate the in-memory artist object so a SECOND event applied to the
  // same artist later in this same run builds on the updated subtotal,
  // instead of silently overwriting it (a real bug fixed here).
  artist.momentum_score = subtotals.momentum_score;
  artist.performance_score = subtotals.performance_score;
  artist.activity_score = subtotals.activity_score;
  artist.culture_score = subtotals.culture_score;
  artist.score = weighted;

  const { data: activeSeason } = await supabase
    .from("seasons")
    .select("id")
    .eq("is_active", true)
    .single();

  const dampedNote = effectiveDelta !== delta ? " (dominance-dampened)" : "";
  await supabase.from("score_events").insert({
    artist_id: artist.id,
    event_key: eventKey,
    label: label + dampedNote,
    delta: effectiveDelta,
    category,
    season_id: activeSeason?.id || null,
    created_by: null, // automated, no admin user
  });

  return effectiveDelta;
}

export default async () => {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: artists, error } = await supabase
    .from("artists")
    .select(
      "id, name, cost, value, spotify_id, youtube_channel_id, deezer_id, image_url, momentum_score, performance_score, activity_score, culture_score, last_spotify_popularity, last_spotify_followers, last_youtube_view_count, last_youtube_subscribers, last_release_date, last_release_name, last_feature_date, last_deezer_fans, last_deezer_rank"
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

  // --- Weekly transfer reset (shared calendar, not a personal rolling clock) ---
  // Refills everyone's free_transfers TOGETHER, at the same moment the "team"
  // window (captain + trade) opens for the whole pool — Monday's morning run
  // only (UTC hour < 12 excludes the 20:00 run so this fires once per week).
  const now = new Date();
  if (now.getUTCDay() === 1 && now.getUTCHours() < 12) {
    const { data: profiles } = await supabase.from("profiles").select("id, free_transfers");
    for (const p of profiles || []) {
      const refreshed = Math.min((p.free_transfers || 0) + TRANSFER_FREE_PER_WEEK, TRANSFER_BANK_CAP);
      await supabase
        .from("profiles")
        .update({ free_transfers: refreshed, last_transfer_refresh: now.toISOString().slice(0, 10) })
        .eq("id", p.id);
    }
    results.transfersReset = (profiles || []).length;
  }

  // Pool average — used for anti-dominance dampening (computed BEFORE this
  // run's changes, so it reflects standing coming into today).
  const poolAverage =
    artists.reduce((sum, a) => sum + (a.score || 0), 0) / (artists.length || 1);

  // --- Event decay pass ---
  // Every category subtotal fades slightly each run unless reinforced by a
  // new real event this run. This stops an artist's score from being
  // permanently inflated by something that happened months ago — momentum
  // has to be sustained, not just accumulated once.
  for (const artist of artists) {
    const decayed = {
      momentum_score: Math.round((artist.momentum_score || 0) * (1 - RULES.DECAY_RATE)),
      performance_score: Math.round((artist.performance_score || 0) * (1 - RULES.DECAY_RATE)),
      activity_score: Math.round((artist.activity_score || 0) * (1 - RULES.DECAY_RATE)),
      culture_score: Math.round((artist.culture_score || 0) * (1 - RULES.DECAY_RATE)),
    };
    const weighted = Math.round(
      decayed.momentum_score * 0.4 +
        decayed.performance_score * 0.3 +
        decayed.activity_score * 0.2 +
        decayed.culture_score * 0.1
    );
    await supabase.from("artists").update({ ...decayed, score: weighted }).eq("id", artist.id);
    Object.assign(artist, decayed, { score: weighted });
    artist._scoreAtRunStart = weighted; // baseline for this run's value calc
    // Per-category baselines too — lets us say WHICH category drove a value
    // change (momentum vs. a release vs. culture), not just "it moved".
    artist._momentumAtRunStart = decayed.momentum_score;
    artist._performanceAtRunStart = decayed.performance_score;
    artist._activityAtRunStart = decayed.activity_score;
    artist._cultureAtRunStart = decayed.culture_score;
  }

  for (const artist of artists) {
    try {
      // --- Spotify popularity + followers -> Momentum ---
      if (spotifyToken && artist.spotify_id) {
        const spotifyData = await getSpotifyArtistData(spotifyToken, artist.spotify_id);
        if (spotifyData) {
          if (spotifyData.popularity !== null) {
            if (artist.last_spotify_popularity !== null && artist.last_spotify_popularity !== undefined) {
              const delta = spotifyData.popularity - artist.last_spotify_popularity;
              if (delta !== 0) {
                await applyScoreEvent(
                  supabase,
                  artist,
                  "momentum",
                  delta,
                  delta > 0
                    ? `🔥 Trending up on Spotify (+${delta})`
                    : `📉 Cooling off on Spotify (${delta})`,
                  "stream_tick",
                  poolAverage
                );
                results.spotifySynced++;
              }
            }
          }
          if (spotifyData.followers !== null) {
            if (artist.last_spotify_followers) {
              const rawDelta = spotifyData.followers - artist.last_spotify_followers;
              const scaledDelta = Math.max(-8, Math.min(8, Math.round(rawDelta / 1000)));
              if (scaledDelta !== 0) {
                await applyScoreEvent(
                  supabase,
                  artist,
                  "momentum",
                  scaledDelta,
                  scaledDelta > 0
                    ? `👥 Gaining new Spotify followers`
                    : `👥 Losing some Spotify followers`,
                  "stream_tick",
                  poolAverage
                );
              }
            }
          }
          await supabase
            .from("artists")
            .update({
              last_spotify_popularity: spotifyData.popularity,
              last_spotify_followers: spotifyData.followers,
              last_synced_at: new Date().toISOString(),
            })
            .eq("id", artist.id);
        }
      }

      // --- YouTube view + subscriber growth -> Momentum ---
      if (artist.youtube_channel_id) {
        const ytStats = await getYoutubeStats(artist.youtube_channel_id);
        if (ytStats) {
          if (artist.last_youtube_view_count) {
            const rawDelta = ytStats.viewCount - artist.last_youtube_view_count;
            const scaledDelta = Math.max(-10, Math.min(10, Math.round(rawDelta / 100000)));
            if (scaledDelta !== 0) {
              await applyScoreEvent(
                supabase,
                artist,
                "momentum",
                scaledDelta,
                scaledDelta > 0
                  ? `▶️ YouTube views climbing fast`
                  : `▶️ YouTube views slowing down`,
                "view_spike",
                poolAverage
              );
              results.youtubeSynced++;
            }
          }
          if (artist.last_youtube_subscribers) {
            const rawDelta = ytStats.subscriberCount - artist.last_youtube_subscribers;
            const scaledDelta = Math.max(-6, Math.min(6, Math.round(rawDelta / 500)));
            if (scaledDelta !== 0) {
              await applyScoreEvent(
                supabase,
                artist,
                "momentum",
                scaledDelta,
                scaledDelta > 0
                  ? `🔔 New YouTube subscribers coming in`
                  : `🔔 YouTube subscriber growth slowing`,
                "view_spike",
                poolAverage
              );
            }
          }
          await supabase
            .from("artists")
            .update({
              last_youtube_view_count: ytStats.viewCount,
              last_youtube_subscribers: ytStats.subscriberCount,
            })
            .eq("id", artist.id);
        }

        // --- Upcoming premiere detection (the "incoming" signal) ---
        const premieres = await getUpcomingPremieres(artist.youtube_channel_id);
        for (const p of premieres) {
          if (!p.publishedAt) continue;
          const { error: upErr } = await supabase.from("upcoming_releases").insert({
            artist_id: artist.id,
            title: p.title,
            scheduled_at: p.publishedAt,
            source: "youtube_premiere",
            video_url: `https://www.youtube.com/watch?v=${p.videoId}`,
          });
          if (!upErr) results.upcomingDetected = (results.upcomingDetected || 0) + 1;
          // unique constraint silently skips duplicates on repeat syncs
        }
      }

      // --- Deezer fan count -> Momentum, top-track rank -> Performance ---
      // (first genuinely automated Performance-category signal, no key needed)
      {
        let deezerId = artist.deezer_id;
        if (!deezerId) {
          const found = await searchDeezerArtist(artist.name);
          if (found) {
            deezerId = found.id;
            await supabase.from("artists").update({ deezer_id: deezerId }).eq("id", artist.id);
          }
        }
        if (deezerId) {
          const stats = await getDeezerArtistStats(deezerId);
          // Auto-fill the artist's face from Deezer if we don't have one yet.
          // This is what makes faces "just appear" for any new artist — no manual step.
          if (stats && stats.picture && !artist.image_url) {
            await supabase
              .from("artists")
              .update({ image_url: stats.picture })
              .eq("id", artist.id);
            artist.image_url = stats.picture;
          }
          if (stats && stats.fans !== null) {
            if (artist.last_deezer_fans) {
              const rawDelta = stats.fans - artist.last_deezer_fans;
              const scaledDelta = Math.max(-6, Math.min(6, Math.round(rawDelta / 1000)));
              if (scaledDelta !== 0) {
                await applyScoreEvent(
                  supabase,
                  artist,
                  "momentum",
                  scaledDelta,
                  scaledDelta > 0 ? `🎧 Growing on Deezer` : `🎧 Slowing on Deezer`,
                  "stream_tick",
                  poolAverage
                );
              }
            }
            await supabase.from("artists").update({ last_deezer_fans: stats.fans }).eq("id", artist.id);
          }

          const topTrack = await getDeezerTopTrackRank(deezerId);
          if (topTrack && topTrack.rank !== null) {
            if (artist.last_deezer_rank) {
              const rawDelta = topTrack.rank - artist.last_deezer_rank;
              const scaledDelta = Math.max(-8, Math.min(8, Math.round(rawDelta / 5000)));
              if (scaledDelta !== 0) {
                await applyScoreEvent(
                  supabase,
                  artist,
                  "performance",
                  scaledDelta,
                  scaledDelta > 0
                    ? `📈 "${topTrack.trackName}" climbing on Deezer`
                    : `📉 "${topTrack.trackName}" fading on Deezer`,
                  "chart_up",
                  poolAverage
                );
              }
            }
            await supabase.from("artists").update({ last_deezer_rank: topTrack.rank }).eq("id", artist.id);
          }
        }
      }

      // --- New release detection -> Activity (the "boom" moment) ---
      if (spotifyToken && artist.spotify_id) {
        const release = await getLatestRelease(spotifyToken, artist.spotify_id);
        if (release && release.releaseDate) {
          const isNewRelease =
            artist.last_release_date && release.releaseDate > artist.last_release_date;
          const isFirstSync = !artist.last_release_date;

          if (isNewRelease) {
            const delta = release.type === "album" ? 30 : 10; // album vs single/feature
            await applyScoreEvent(
              supabase,
              artist,
              "activity",
              delta,
              release.type === "album"
                ? `💿 New album dropped: "${release.name}"`
                : `🎵 New single dropped: "${release.name}"`,
              release.type === "album" ? "label_deal" : "feature",
              poolAverage
            );
            results.releasesDetected = (results.releasesDetected || 0) + 1;
          }

          if (isNewRelease || isFirstSync) {
            await supabase
              .from("artists")
              .update({ last_release_date: release.releaseDate, last_release_name: release.name })
              .eq("id", artist.id);
          }
        }
      }

      // --- New feature detection ("appears_on") -> Activity ---
      if (spotifyToken && artist.spotify_id) {
        const feature = await getLatestFeature(spotifyToken, artist.spotify_id);
        if (feature && feature.releaseDate) {
          const isNewFeature =
            artist.last_feature_date && feature.releaseDate > artist.last_feature_date;
          const isFirstFeatureSync = !artist.last_feature_date;

          if (isNewFeature) {
            await applyScoreEvent(
              supabase,
              artist,
              "activity",
              10,
              `🤝 New feature: "${feature.name}"${feature.byArtist ? ` with ${feature.byArtist}` : ""}`,
              "feature",
              poolAverage
            );
            results.featuresDetected = (results.featuresDetected || 0) + 1;
          }

          if (isNewFeature || isFirstFeatureSync) {
            await supabase
              .from("artists")
              .update({ last_feature_date: feature.releaseDate })
              .eq("id", artist.id);
          }
        }
      }

      // --- News (Google News RSS + Booska-P — both free, no key needed) ---
      {
        const [googleArticles, booskaArticles] = await Promise.all([
          getArtistNews(artist.name),
          getBooskaPArtistNews(artist.name).catch(() => []),
        ]);
        for (const a of [...googleArticles, ...booskaArticles]) {
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
      // --- Dynamic market value update ---
      // artist.score has been mutated in-memory by every applyScoreEvent
      // call above (including decay) — compare to the pre-run baseline to
      // get this run's net movement, then nudge value proportionally.
      const netMovement = artist.score - (artist._scoreAtRunStart ?? artist.score);
      if (netMovement !== 0 && artist.cost) {
        const currentValue = artist.value ?? artist.cost;
        const proposedValue = currentValue * (1 + netMovement / RULES.VALUE_SENSITIVITY);
        const newValue = Math.round(
          Math.max(
            artist.cost * RULES.VALUE_MIN_MULTIPLIER,
            Math.min(artist.cost * RULES.VALUE_MAX_MULTIPLIER, proposedValue)
          )
        );
        if (newValue !== currentValue) {
          const reason = buildValueReason(artist);
          await supabase
            .from("artists")
            .update({ value: newValue, value_reason: reason, value_reason_at: new Date().toISOString() })
            .eq("id", artist.id);
        }
      }
      // --- Milestones (round-number score thresholds) ---
      const MILESTONE_THRESHOLDS = [50, 100, 250, 500, 1000, 2000];
      const scoreBefore = artist._scoreAtRunStart ?? 0;
      for (const threshold of MILESTONE_THRESHOLDS) {
        if (scoreBefore < threshold && artist.score >= threshold) {
          const { error: msErr } = await supabase
            .from("milestones")
            .insert({ artist_id: artist.id, threshold });
          if (!msErr) {
            await applyScoreEvent(
              supabase,
              artist,
              "culture",
              5,
              `🏆 Passed ${threshold} points!`,
              "viral",
              poolAverage
            );
            results.milestonesHit = (results.milestonesHit || 0) + 1;
          }
          // unique constraint silently skips if already awarded — safe to retry
        }
      }
    } catch (e) {
      results.errors.push(`${artist.name}: ${e.message}`);
    }
  }

  // --- General rap news ticker (Booska-P feed, not tied to one artist) ---
  // Feeds the Radar's "Actu rap" block — the holistic, non-artist-specific
  // signal. Manual dedupe by URL since a null artist_id defeats the table's
  // (artist_id, url) unique constraint (Postgres treats every NULL as distinct).
  try {
    const generalNews = await getGeneralRapNews();
    for (const n of generalNews) {
      if (!n.url) continue;
      const { data: existing } = await supabase
        .from("artist_news")
        .select("id")
        .eq("url", n.url)
        .limit(1);
      if (existing && existing.length) continue;
      await supabase.from("artist_news").insert({
        artist_id: null,
        title: n.title,
        url: n.url,
        source: n.source,
        published_at: n.published_at,
      });
    }
  } catch (e) {
    results.errors.push(`general news: ${e.message}`);
  }

  // --- Weekly Award: "Most Momentum This Week" ---
  // Computed once per run across the whole pool, upserted so there's
  // always exactly one current leader shown for the active week.
  try {
    const now = new Date();
    const dayOfWeek = now.getUTCDay(); // 0 = Sunday
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekStart = new Date(now);
    weekStart.setUTCDate(now.getUTCDate() - mondayOffset);
    const weekStartStr = weekStart.toISOString().slice(0, 10);

    const { data: weekEvents } = await supabase
      .from("score_events")
      .select("artist_id, delta")
      .gte("created_at", weekStart.toISOString());

    const totals = {};
    for (const ev of weekEvents || []) {
      totals[ev.artist_id] = (totals[ev.artist_id] || 0) + ev.delta;
    }
    const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0 && sorted[0][1] > 0) {
      const [topArtistId, topValue] = sorted[0];
      await supabase.from("weekly_awards").upsert(
        {
          award_type: "most_momentum",
          artist_id: topArtistId,
          week_start: weekStartStr,
          value: topValue,
          computed_at: new Date().toISOString(),
        },
        { onConflict: "award_type,week_start" }
      );
    }
  } catch (e) {
    results.errors.push(`weekly award: ${e.message}`);
  }

  console.log("Daily sync complete:", JSON.stringify(results));
  return new Response(JSON.stringify(results), {
    headers: { "Content-Type": "application/json" },
  });
};

export const config = {
  schedule: "0 8,20 * * *", // twice daily: 8am and 8pm UTC
};
