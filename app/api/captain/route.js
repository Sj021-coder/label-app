import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWeeklyProgram, formatCountdown } from "@/lib/weeklyProgram";

export async function POST(request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const program = getWeeklyProgram();
  if (program.phase !== "team") {
    return NextResponse.json(
      {
        error: `La fenêtre capitaine est fermée. Prochaine ouverture dans ${formatCountdown(
          program.nextAt
        )}.`,
      },
      { status: 403 }
    );
  }

  const { artistId } = await request.json();

  // Validate the artist is actually in this user's roster
  const { data: entry } = await supabase
    .from("roster_entries")
    .select("artist_id")
    .eq("user_id", user.id)
    .eq("artist_id", artistId)
    .single();

  if (!entry) {
    return NextResponse.json({ error: "Cet artiste n'est pas dans ton roster." }, { status: 400 });
  }

  const { error } = await supabase
    .from("profiles")
    .update({ captain_artist_id: artistId })
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
