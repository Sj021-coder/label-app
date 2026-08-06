import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { artistId, spotifyId, youtubeChannelId } = await request.json();

  const update = {};
  if (spotifyId !== undefined) update.spotify_id = spotifyId;
  if (youtubeChannelId !== undefined) update.youtube_channel_id = youtubeChannelId;

  const { error } = await supabase.from("artists").update(update).eq("id", artistId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
