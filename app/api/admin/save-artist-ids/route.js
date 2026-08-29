import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/supabase/admin";
import { getSpotifyArtistDetails } from "@/lib/integrations/spotify";

export async function POST(request) {
  const { supabase, user, isAdmin } = await getAdminContext();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!isAdmin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const { artistId, spotifyId, youtubeChannelId } = await request.json();

  const update = {};
  let mappedTo = null;
  if (spotifyId !== undefined) {
    update.spotify_id = spotifyId;
    // Fetch name + photo + genres in one call (best-effort — save still
    // succeeds even if this fails). The name comes back to the UI so a
    // wrong mapping is visible the instant it's made, e.g. "✓ Mappé à :
    // black midi" is an immediate red flag when you meant to save "Black M".
    if (spotifyId) {
      const details = await getSpotifyArtistDetails(spotifyId);
      if (details) {
        if (details.image) update.image_url = details.image;
        mappedTo = { name: details.name, genres: details.genres };
      }
    }
  }
  if (youtubeChannelId !== undefined) update.youtube_channel_id = youtubeChannelId;

  const { error } = await supabase.from("artists").update(update).eq("id", artistId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, mappedTo });
}
