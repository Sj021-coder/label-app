import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/supabase/admin";
import { SCORING_EVENTS } from "@/lib/scoringEvents";
import { computeWeightedScore } from "@/lib/gameRules";

export async function POST(request) {
  const { supabase, user, isAdmin } = await getAdminContext();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await request.json();
  const { artistId, eventKey, customDelta, customCategory, reason } = body;

  const eventDef = SCORING_EVENTS.find((e) => e.key === eventKey);
  if (!eventDef) {
    return NextResponse.json({ error: "Unknown event key" }, { status: 400 });
  }

  const isCustom = eventKey === "custom";
  const delta = isCustom ? Number(customDelta) || 0 : eventDef.delta;
  const label = isCustom ? reason || "Custom adjustment" : eventDef.label;
  const category = isCustom ? customCategory : eventDef.category;

  if (!["momentum", "performance", "activity", "culture"].includes(category)) {
    return NextResponse.json({ error: "Invalid or missing category" }, { status: 400 });
  }

  const { data: artist, error: fetchErr } = await supabase
    .from("artists")
    .select("id, momentum_score, performance_score, activity_score, culture_score")
    .eq("id", artistId)
    .single();

  if (fetchErr || !artist) {
    return NextResponse.json({ error: "Artist not found" }, { status: 404 });
  }

  const updatedSubtotals = {
    momentum_score: artist.momentum_score,
    performance_score: artist.performance_score,
    activity_score: artist.activity_score,
    culture_score: artist.culture_score,
  };
  updatedSubtotals[`${category}_score`] += delta;

  const newScore = computeWeightedScore(updatedSubtotals);

  const { error: updateErr } = await supabase
    .from("artists")
    .update({ ...updatedSubtotals, score: newScore })
    .eq("id", artistId);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // Tag the event with the current active season, if one exists
  const { data: activeSeason } = await supabase
    .from("seasons")
    .select("id")
    .eq("is_active", true)
    .single();

  const { error: logErr } = await supabase.from("score_events").insert({
    artist_id: artistId,
    event_key: eventKey,
    label,
    delta,
    category,
    season_id: activeSeason?.id || null,
    created_by: user.id,
  });

  if (logErr) {
    return NextResponse.json({ error: logErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, newScore });
}
