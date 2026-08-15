import { createClient } from "@/lib/supabase/server";
import { PICKEM_STAKE } from "@/lib/gameRules";
import PickemClient from "./PickemClient";

export default async function PickemPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: predictions } = await supabase
    .from("predictions")
    .select("id, question, option_a, option_b, correct_option, closes_at, coefficient")
    .order("closes_at", { ascending: false });

  const { data: myPicks } = await supabase
    .from("prediction_picks")
    .select("prediction_id, chosen_option")
    .eq("user_id", user.id);

  const { data: profile } = await supabase
    .from("profiles")
    .select("pickem_score")
    .eq("id", user.id)
    .single();

  return (
    <PickemClient
      predictions={predictions || []}
      myPicks={myPicks || []}
      pickemScore={profile?.pickem_score || 0}
      stake={PICKEM_STAKE}
    />
  );
}
