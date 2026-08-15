import Link from "next/link";
import { getAdminContext } from "@/lib/supabase/admin";
import AdminForm from "./AdminForm";
import AdminPickem from "./AdminPickem";
import AdminMapping from "./AdminMapping";
import MetricsPanel from "./MetricsPanel";

export default async function AdminPage() {
  // 🔒 Admin gate: only a profile with is_admin = true may see this page.
  // Non-admins get a clear, friendly explanation instead of a silent bounce.
  const { supabase, isAdmin } = await getAdminContext();
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center text-center px-6 pt-16 pb-10">
        <div className="text-4xl mb-4">🔒</div>
        <div className="display text-2xl mb-2">Espace équipe</div>
        <p className="text-[var(--text-muted)] text-sm max-w-xs mb-1">
          Cette section est le tableau de bord des organisateurs — gestion des
          scores, des pronostics et des artistes.
        </p>
        <p className="text-[var(--text-faint)] text-xs max-w-xs mb-6">
          Rien n&apos;est cassé ! Elle n&apos;est simplement pas nécessaire pour
          jouer. Ton label et ton classement sont dans les autres onglets.
        </p>
        <Link
          href="/roster"
          className="bg-[var(--gold)] text-[#1a1310] font-extrabold uppercase tracking-wide text-sm rounded-xl py-3 px-6"
        >
          Retour à mon label
        </Link>
      </div>
    );
  }

  const { data: artists } = await supabase
    .from("artists")
    .select("id, name, initials, color, score, spotify_id, youtube_channel_id")
    .order("name");

  const { data: predictions } = await supabase
    .from("predictions")
    .select("id, question, option_a, option_b, correct_option, closes_at")
    .order("created_at", { ascending: false })
    .limit(15);

  const { data: newsItems } = await supabase
    .from("artist_news")
    .select("id, title, url, source, artist_id, artists(name)")
    .eq("reviewed", false)
    .order("fetched_at", { ascending: false })
    .limit(20);

  // 📊 KPIs. Accounts + captains are exact all-time (from profiles);
  // drafted + shares are counted from the events table (start from tracking).
  const [
    { count: accounts },
    { count: captains },
    { count: drafted },
    { count: shares },
  ] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .not("captain_artist_id", "is", null),
    supabase
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("event_type", "roster_drafted"),
    supabase
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("event_type", "share"),
  ]);

  return (
    <div>
      <div className="text-[13px] uppercase tracking-wide text-[var(--text-faint)] font-bold mb-3">
        Métriques
      </div>
      <MetricsPanel
        accounts={accounts}
        drafted={drafted}
        captains={captains}
        shares={shares}
      />

      <div className="mt-10 pt-6 border-t border-[var(--border)]">
        <div className="text-[13px] uppercase tracking-wide text-[var(--text-faint)] font-bold mb-3">
          Moteur de scoring
        </div>
        <AdminForm artists={artists || []} />
      </div>

      <div className="mt-10 pt-6 border-t border-[var(--border)]">
        <div className="text-[13px] uppercase tracking-wide text-[var(--text-faint)] font-bold mb-3">
          Gestion Pick&apos;em
        </div>
        <AdminPickem artists={artists || []} predictions={predictions || []} />
      </div>

      <div className="mt-10 pt-6 border-t border-[var(--border)]">
        <div className="text-[13px] uppercase tracking-wide text-[var(--text-faint)] font-bold mb-3">
          IDs API (Spotify / YouTube) & Actualités
        </div>
        <AdminMapping artists={artists || []} newsItems={newsItems || []} />
      </div>
    </div>
  );
}
