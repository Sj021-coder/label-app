import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/supabase/admin";
import { PICKEM_STAKE } from "@/lib/gameRules";

export async function POST(request) {
  const { supabase, user, isAdmin } = await getAdminContext();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!isAdmin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const { predictionId, correctOption } = await request.json();

  const { data: prediction, error: predErr } = await supabase
    .from("predictions")
    .select("coefficient")
    .eq("id", predictionId)
    .single();
  if (predErr || !prediction) {
    return NextResponse.json({ error: "Prediction not found" }, { status: 404 });
  }
  const coefficient = Number(prediction.coefficient) || 2;

  const { error: updateErr } = await supabase
    .from("predictions")
    .update({ correct_option: correctOption })
    .eq("id", predictionId);
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  const { data: allPicks } = await supabase
    .from("prediction_picks")
    .select("user_id, chosen_option")
    .eq("prediction_id", predictionId);

  // Betting math: everyone who picked risked PICKEM_STAKE. Correct picks get
  // their stake back PLUS profit (stake * (coefficient - 1)). Wrong picks
  // forfeit the stake. Non-participants are untouched — missing the window
  // costs them the CHANCE, never points they hadn't risked.
  const winDelta = Math.round(PICKEM_STAKE * (coefficient - 1));
  let winners = 0;
  let losers = 0;

  for (const pick of allPicks || []) {
    const won = pick.chosen_option === correctOption;
    const change = won ? winDelta : -PICKEM_STAKE;
    const { data: profile } = await supabase
      .from("profiles")
      .select("pickem_score")
      .eq("id", pick.user_id)
      .single();
    await supabase
      .from("profiles")
      .update({ pickem_score: (profile?.pickem_score || 0) + change })
      .eq("id", pick.user_id);
    if (won) winners++;
    else losers++;
  }

  return NextResponse.json({ success: true, winners, losers, winDelta, stake: PICKEM_STAKE });
}
