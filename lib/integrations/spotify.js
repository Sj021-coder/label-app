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

// Search Spotify for an artist by name — used by the Admin ID-mapping tool
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
    image: a.images?.[2]?.url || a.images?.[0]?.url || null,
  }));
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
