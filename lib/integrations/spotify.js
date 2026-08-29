// Spotify Web API — Client Credentials flow (no user login needed,
// works for public data: artist popularity, search).
// Needs SPOTIFY_CLIENT_ID + SPOTIFY_CLIENT_SECRET env vars.

let cachedToken = null;
let cachedTokenExpiresAt = 0;

export async function getSpotifyAccessToken() {
  if (cachedToken && Date.now() < cachedTokenExpiresAt) return cachedToken;

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Missing SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET env vars");
  }

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) throw new Error(`Spotify auth failed: ${res.status}`);
  const data = await res.json();
  cachedToken = data.access_token;
  cachedTokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000; // refresh 1 min early
  return cachedToken;
}

// Search Spotify for an artist by name — used by the Admin ID-mapping tool.
// `genres` added after a real incident: for short/ambiguous French rap
// names, Spotify's top-ranked result is often an unrelated international
// act (a UK rock band for "Black M", a Canadian singer for "Kikesa"), and
// name + follower count alone gave the admin nothing to catch that with.
// Genres (and the already-fetched-but-previously-unused photo) are the
// signal that makes a wrong match visibly wrong before it's saved.
export async function searchSpotifyArtist(name) {
  const token = await getSpotifyAccessToken();
  const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(name)}&type=artist&limit=5`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Spotify search failed: ${res.status}`);
  const data = await res.json();
  return (data.artists?.items || []).map((a) => ({
    id: a.id,
    name: a.name,
    popularity: a.popularity,
    followers: a.followers?.total,
    genres: a.genres || [],
    image: a.images?.[2]?.url || a.images?.[0]?.url || null,
  }));
}

// Get the artist's photo URL for a known Spotify artist ID.
// Returns null if none / on any error (never throws — it's a nice-to-have).
export async function getSpotifyArtistImage(spotifyId) {
  try {
    const token = await getSpotifyAccessToken();
    const res = await fetch(`https://api.spotify.com/v1/artists/${spotifyId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.images?.[0]?.url || null;
  } catch {
    return null;
  }
}

// Name + image + genres in one call — used right after an admin saves a
// mapping, so the UI can echo back "✓ Mappé à : black midi" and the
// mistake is visible the moment it's made, not days later on Radar.
// Returns null on any error (never throws — save must still succeed even
// if this confirmation lookup fails).
export async function getSpotifyArtistDetails(spotifyId) {
  try {
    const token = await getSpotifyAccessToken();
    const res = await fetch(`https://api.spotify.com/v1/artists/${spotifyId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return { name: data.name, image: data.images?.[0]?.url || null, genres: data.genres || [] };
  } catch {
    return null;
  }
}

// Get current popularity (0-100) for a known Spotify artist ID —
// this is the proxy we use for Momentum + Performance, since Spotify
// does not expose raw stream counts via public API.
export async function getSpotifyArtistPopularity(spotifyId) {
  const token = await getSpotifyAccessToken();
  const res = await fetch(`https://api.spotify.com/v1/artists/${spotifyId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Spotify artist lookup failed: ${res.status}`);
  const data = await res.json();
  return { popularity: data.popularity, followers: data.followers?.total };
}
