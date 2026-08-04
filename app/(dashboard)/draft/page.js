import { createClient } from "@/lib/supabase/server";
import DraftList from "./DraftList";

export default async function DraftPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: artists } = await supabase
    .from("artists")
    .select("id, name, initials, color, score")
    .order("name");

  const { data: rosterRows } = await supabase
    .from("roster_entries")
    .select("artist_id")
    .eq("user_id", user.id);

  const rosterIds = (rosterRows || []).map((r) => r.artist_id);

  return (
    <div>
      <div className="text-[13px] uppercase tracking-wide text-[var(--text-faint)] font-bold mb-3">
        Tous les artistes
      </div>
      <DraftList artists={artists || []} initialRosterIds={rosterIds} />
    </div>
  );
}
