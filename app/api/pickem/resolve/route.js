import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/supabase/admin";
import { PICKEM_STAKE } from "@/lib/gameRules";
import { sendPushToUser } from "@/lib/push/send";

export async function POST(request) {
  const { supabase, user, isAdmin } = await getAdminContext();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!isAdmin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const { predictionId, correctOption } = await request.json();

  const { data: prediction, error: predErr } = await supabase
    .from("predictions")
    .select("coefficient, question")
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

  // Betting math, deliberately asymmetric: winning pays more than losing
  // costs (losing is 2/3 of the win amount) — losses should sting less than
  // wins feel good, so the downside never outweighs the reason to play.
  // Non-participants are untouched — missing the window costs them the
  // CHANCE, never points they hadn't risked.
  const winDelta = Math.round(PICKEM_STAKE * (coefficient - 1));
  const loseDelta = Math.round((2 / 3) * winDelta);
  let winners = 0;
  let losers = 0;

  for (const pick of allPicks || []) {
    const won = pick.chosen_option === correctOption;
    const change = won ? winDelta : -loseDelta;
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

    // Fire-and-forget: a slow/failed push must never block resolving the
    // prediction or updating anyone else's score. sendPushToUser already
    // swallows per-device errors internally, so this only fails if the
    // whole push subsystem is down, and even then it must stay silent here.
    sendPushToUser(pick.user_id, {
      title: won ? "✅ Bien vu !" : "❌ Raté cette fois",
      body: `« ${prediction.question} » — ${won ? `+${winDelta}` : `-${loseDelta}`} pts`,
      url: "/pickem",
    }).catch(() => {});
  }

  return NextResponse.json({ success: true, winners, losers, winDelta, loseDelta, stake: PICKEM_STAKE });
}
