import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NavTabs from "@/components/NavTabs";

export default async function DashboardLayout({ children }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/");

  const { data: myRoster } = await supabase
    .from("roster_entries")
    .select("artist_id, artists(score)")
    .eq("user_id", user.id);

  const myScore = (myRoster || []).reduce(
    (sum, r) => sum + (r.artists?.score || 0),
    0
  );

  return (
    <div>
      <div className="flex items-center justify-between px-4 pt-5 pb-3">
        <div className="display text-2xl">
          LABEL<span className="text-[var(--gold)]">.</span>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wide text-[var(--text-faint)]">
            {profile.username}
          </div>
          <div className="mono font-bold text-lg">{myScore} pts</div>
        </div>
      </div>
      <NavTabs />
      <div className="px-4 pb-10">{children}</div>
    </div>
  );
}
