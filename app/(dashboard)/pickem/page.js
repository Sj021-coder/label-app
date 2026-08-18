import { createClient } from "@/lib/supabase/server";
import { PICKEM_STAKE } from "@/lib/gameRules";
import PickemClient from "./PickemClient";
import WeeklyDigest from "./WeeklyDigest";

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

  // --- Weekly digest data (Thursday's "actu" half) ---
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [{ data: weekEvents }, { data: upcoming }, { data: news }] = await Promise.all([
    supabase
      .from("score_events")
      .select("artist_id, delta, artists(name, initials, color, image_url)")
      .gte("created_at", sevenDaysAgo.toISOString()),
    supabase
      .from("upcoming_releases")
      .select("id, title, scheduled_at, artists(name)")
      .gte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(5),
    supabase
      .from("artist_news")
      .select("id, title, url")
      .is("artist_id", null)
      .order("published_at", { ascending: false })
      .limit(5),
  ]);

  const totals = {};
  for (const ev of weekEvents || []) {
    if (!ev.artists) continue;
    const key = ev.artist_id;
    if (!totals[key]) totals[key] = { artist: ev.artists, sum: 0 };
    totals[key].sum += ev.delta;
  }
  const movers = Object.values(totals)
    .filter((m) => m.sum !== 0)
    .sort((a, b) => Math.abs(b.sum) - Math.abs(a.sum))
    .slice(0, 6);

  return (
    <div>
      <WeeklyDigest movers={movers} upcoming={upcoming || []} news={news || []} />
      <PickemClient
        predictions={predictions || []}
        myPicks={myPicks || []}
        pickemScore={profile?.pickem_score || 0}
        stake={PICKEM_STAKE}
      />
    </div>
  );
}
