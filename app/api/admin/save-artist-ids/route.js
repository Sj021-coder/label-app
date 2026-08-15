import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/supabase/admin";
import { getSpotifyArtistImage } from "@/lib/integrations/spotify";

export async function POST(request) {
  const { supabase, user, isAdmin } = await getAdminContext();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!isAdmin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const { artistId, spotifyId, youtubeChannelId } = await request.json();

  const update = {};
  if (spotifyId !== undefined) {
    update.spotify_id = spotifyId;
    // Auto-grab the artist's photo from Spotify at mapping time (best-effort).
    if (spotifyId) {
      const img = await getSpotifyArtistImage(spotifyId);
      if (img) update.image_url = img;
    }
  }
  if (youtubeChannelId !== undefined) update.youtube_channel_id = youtubeChannelId;

  const { error } = await supabase.from("artists").update(update).eq("id", artistId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
