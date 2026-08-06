// YouTube Data API v3 — needs YOUTUBE_API_KEY env var.

export async function searchYoutubeChannel(name) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) throw new Error("Missing YOUTUBE_API_KEY env var");

  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(
    name
  )}&maxResults=5&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`YouTube search failed: ${res.status}`);
  const data = await res.json();
  return (data.items || []).map((item) => ({
    channelId: item.snippet.channelId,
    title: item.snippet.title,
    thumbnail: item.snippet.thumbnails?.default?.url || null,
  }));
}

export async function getYoutubeChannelStats(channelId) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) throw new Error("Missing YOUTUBE_API_KEY env var");

  const url = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelId}&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`YouTube channel lookup failed: ${res.status}`);
  const data = await res.json();
  const stats = data.items?.[0]?.statistics;
  if (!stats) return null;
  return {
    viewCount: Number(stats.viewCount || 0),
    subscriberCount: Number(stats.subscriberCount || 0),
  };
}
