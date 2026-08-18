import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NavTabs from "@/components/NavTabs";
import WeeklyBanner from "@/components/WeeklyBanner";
import { getBilanWindow } from "@/lib/weeklyProgram";

export default async function DashboardLayout({ children }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, is_admin, created_at")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/");

  const bilanReady = getBilanWindow(profile.created_at).ready;

  const [{ data: totals }, { data: activeSeason }] = await Promise.all([
    supabase.from("user_totals").select("*").eq("user_id", user.id).single(),
    supabase.from("seasons").select("name").eq("is_active", true).single(),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between px-4 pt-5 pb-1">
        <div className="display text-2xl">
          LABEL<span className="text-[var(--gold)]">.</span>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wide text-[var(--text-faint)]">
            {profile.username}
          </div>
          <div className="mono font-bold text-lg">{totals?.total_score ?? 0} pts</div>
        </div>
      </div>
      {activeSeason?.name && (
        <div className="px-4 pb-3 text-[10px] text-[var(--text-faint)]">
          Saison : {activeSeason.name}
        </div>
      )}
      <WeeklyBanner bilanReady={bilanReady} />
      <NavTabs isAdmin={!!profile.is_admin} />
      <div className="px-4 pb-10">{children}</div>
    </div>
  );
}
