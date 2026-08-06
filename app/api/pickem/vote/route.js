import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { predictionId, chosenOption } = await request.json();

  const { data: prediction } = await supabase
    .from("predictions")
    .select("closes_at, correct_option")
    .eq("id", predictionId)
    .single();

  if (!prediction) return NextResponse.json({ error: "Prediction not found" }, { status: 404 });
  if (prediction.correct_option) {
    return NextResponse.json({ error: "Ce pick'em est déjà résolu." }, { status: 400 });
  }
  if (new Date(prediction.closes_at) < new Date()) {
    return NextResponse.json({ error: "Ce pick'em est fermé." }, { status: 400 });
  }

  const { error } = await supabase
    .from("prediction_picks")
    .insert({ prediction_id: predictionId, user_id: user.id, chosen_option: chosenOption });

  if (error) {
    return NextResponse.json(
      { error: error.code === "23505" ? "Tu as déjà voté." : error.message },
      { status: 400 }
    );
  }

  return NextResponse.json({ success: true });
}
