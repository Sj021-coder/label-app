// News — Currents API (chosen because its free tier is production-safe,
// unlike NewsAPI.org/GNews which restrict free tiers to localhost/non-commercial).
// Needs CURRENTS_API_KEY env var. Docs: https://currentsapi.services/en/docs

export async function searchArtistNews(artistName) {
  const apiKey = process.env.CURRENTS_API_KEY;
  if (!apiKey) throw new Error("Missing CURRENTS_API_KEY env var");

  const url = `https://api.currentsapi.services/v1/search?keywords=${encodeURIComponent(
    artistName
  )}&language=fr&apiKey=${apiKey}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`News search failed: ${res.status}`);
  const data = await res.json();

  return (data.news || []).map((n) => ({
    title: n.title,
    url: n.url,
    source: n.author || n.category?.[0] || null,
    publishedAt: n.published,
  }));
}
