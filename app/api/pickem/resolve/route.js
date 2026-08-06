import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PICKEM_POINTS_CORRECT } from "@/lib/gameRules";

export async function POST(request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { predictionId, correctOption } = await request.json();

  const { error: updateErr } = await supabase
    .from("predictions")
    .update({ correct_option: correctOption })
    .eq("id", predictionId);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  const { data: correctPicks } = await supabase
    .from("prediction_picks")
    .select("user_id")
    .eq("prediction_id", predictionId)
    .eq("chosen_option", correctOption);

  for (const pick of correctPicks || []) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("pickem_score")
      .eq("id", pick.user_id)
      .single();
    await supabase
      .from("profiles")
      .update({ pickem_score: (profile?.pickem_score || 0) + PICKEM_POINTS_CORRECT })
      .eq("id", pick.user_id);
  }

  return NextResponse.json({ success: true, winnersCount: (correctPicks || []).length });
}
