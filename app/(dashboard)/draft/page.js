import { createClient } from "@/lib/supabase/server";
import DraftList from "./DraftList";

export default async function DraftPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: artists } = await supabase
    .from("artists")
    .select("id, name, initials, color, score, cost, tier")
    .order("tier")
    .order("name");

  const { data: rosterRows } = await supabase
    .from("roster_entries")
    .select("artist_id, artists(id, cost, tier)")
    .eq("user_id", user.id);

  const rosterIds = (rosterRows || []).map((r) => r.artist_id);

  // Recent news count per artist (last 7 days) — decision support for drafting/transfers
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentNews } = await supabase
    .from("artist_news")
    .select("artist_id")
    .gte("fetched_at", sevenDaysAgo);

  const newsCounts = {};
  for (const n of recentNews || []) {
    newsCounts[n.artist_id] = (newsCounts[n.artist_id] || 0) + 1;
  }

  return (
    <div>
      <div className="text-[13px] uppercase tracking-wide text-[var(--text-faint)] font-bold mb-3">
        Tous les artistes
      </div>
      <DraftList
        artists={artists || []}
        initialRosterIds={rosterIds}
        newsCounts={newsCounts}
      />
    </div>
  );
}
