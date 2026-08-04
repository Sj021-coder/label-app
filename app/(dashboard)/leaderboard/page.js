import { createClient } from "@/lib/supabase/server";

export default async function LeaderboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: rows } = await supabase
    .from("leaderboard")
    .select("*")
    .order("total_score", { ascending: false });

  return (
    <div>
      <div className="text-[13px] uppercase tracking-wide text-[var(--text-faint)] font-bold mb-3">
        Classement global
      </div>
      {(!rows || rows.length === 0) && (
        <div className="text-center text-[var(--text-faint)] text-sm py-6">
          Personne n&apos;a encore rejoint.
        </div>
      )}
      {rows?.map((r, i) => (
        <div
          key={r.user_id}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl mb-1.5 border ${
            r.user_id === user.id
              ? "bg-[var(--gold-soft)] border-[var(--gold)]"
              : "border-transparent"
          }`}
        >
          <div className="w-6 text-center mono text-[var(--text-faint)] text-sm">{i + 1}</div>
          <div className="w-8 h-8 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-xs font-bold flex-shrink-0">
            {r.username.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 text-sm font-semibold">
            {r.username}
            {r.user_id === user.id ? " (toi)" : ""}
          </div>
          <div className="mono text-sm font-bold">{r.total_score} pts</div>
        </div>
      ))}
    </div>
  );
}
