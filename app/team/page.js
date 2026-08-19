import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

// Index page — a LIST, not a redirect, because a person can be on several
// teams at once (unlike Creator Leagues, where one-owned-league was the
// working assumption). Every team you're in shows here.
export default async function TeamIndexPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let myTeams = [];
  if (user) {
    const { data: memberRows } = await supabase
      .from("team_members")
      .select("teams(id, handle, name, color, owner_id)")
      .eq("user_id", user.id);
    myTeams = (memberRows || []).map((r) => r.teams).filter(Boolean);
  }

  return (
    <div className="min-h-screen px-5 pt-8 pb-10 max-w-md mx-auto">
      <div className="text-center mb-7">
        <div className="text-4xl mb-2">🤝</div>
        <div className="display text-2xl mb-1">Tes équipes</div>
        <p className="text-[var(--text-muted)] text-sm">
          Pas un classement — une responsabilité partagée. Ce que fait un membre compte
          pour tout le monde.
        </p>
      </div>

      {myTeams.length === 0 ? (
        <div className="text-center text-[var(--text-faint)] text-sm py-6 mb-6">
          Tu n&apos;es dans aucune équipe pour l&apos;instant.
        </div>
      ) : (
        <div className="space-y-2 mb-6">
          {myTeams.map((t) => (
            <Link
              key={t.id}
              href={`/team/${t.handle}`}
              className="flex items-center gap-3 bg-[var(--surface)] border border-[var(--border)] rounded-2xl px-3.5 py-3"
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-black flex-shrink-0"
                style={{ background: t.color }}
              >
                {t.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 text-sm font-semibold">{t.name}</div>
              {t.owner_id === user.id && (
                <span className="text-[10px] text-[var(--text-faint)]">fondateur</span>
              )}
            </Link>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Link
          href="/team/create"
          className="flex-1 text-center bg-[var(--gold)] text-[#1a1310] font-extrabold uppercase tracking-wide text-sm rounded-xl py-3"
        >
          Créer une équipe
        </Link>
        <Link
          href="/teams"
          className="flex-1 text-center bg-[var(--surface)] border border-[var(--border)] font-extrabold uppercase tracking-wide text-sm rounded-xl py-3"
        >
          Classement
        </Link>
      </div>
      <p className="text-center text-[10px] text-[var(--text-faint)] mt-4">
        Un pote t&apos;a envoyé un lien ? Ouvre-le directement — tu n&apos;as pas besoin de
        cette page.
      </p>
    </div>
  );
}
