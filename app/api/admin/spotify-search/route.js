import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchSpotifyArtist } from "@/lib/integrations/spotify";

export async function POST(request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { query } = await request.json();
  try {
    const results = await searchSpotifyArtist(query);
    return NextResponse.json({ results });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
