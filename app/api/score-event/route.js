import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { SCORING_EVENTS } from "@/lib/scoringEvents";

export async function POST(request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const { artistId, eventKey, customDelta, reason } = body;

  const eventDef = SCORING_EVENTS.find((e) => e.key === eventKey);
  if (!eventDef) {
    return NextResponse.json({ error: "Unknown event key" }, { status: 400 });
  }

  const delta = eventKey === "custom" ? Number(customDelta) || 0 : eventDef.delta;
  const label = eventKey === "custom" ? reason || "Custom adjustment" : eventDef.label;

  // fetch current score
  const { data: artist, error: fetchErr } = await supabase
    .from("artists")
    .select("id, score")
    .eq("id", artistId)
    .single();

  if (fetchErr || !artist) {
    return NextResponse.json({ error: "Artist not found" }, { status: 404 });
  }

  const newScore = artist.score + delta;

  const { error: updateErr } = await supabase
    .from("artists")
    .update({ score: newScore })
    .eq("id", artistId);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  const { error: logErr } = await supabase.from("score_events").insert({
    artist_id: artistId,
    event_key: eventKey,
    label,
    delta,
    created_by: user.id,
  });

  if (logErr) {
    return NextResponse.json({ error: logErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, newScore });
}
