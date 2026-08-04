import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { artistId } = await request.json();

  const { error } = await supabase
    .from("roster_entries")
    .insert({ user_id: user.id, artist_id: artistId });

  if (error) {
    // DB trigger raises an exception if roster already has 5 artists
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { artistId } = await request.json();

  const { error } = await supabase
    .from("roster_entries")
    .delete()
    .eq("user_id", user.id)
    .eq("artist_id", artistId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ success: true });
}
