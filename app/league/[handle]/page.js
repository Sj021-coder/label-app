import { createClient } from "@/lib/supabase/server";
import LeagueActions from "./LeagueActions";

const SOCIALS = [
  ["youtube_url", "📺 YouTube"],
  ["twitch_url", "🟣 Twitch"],
  ["tiktok_url", "🎵 TikTok"],
  ["instagram_url", "📸 Instagram"],
];

export default async function LeaguePage({ params }) {
  const { handle } = await params;
  const supabase = await createClient();

  const { data: league } = await supabase
    .from("leagues")
    .select("*")
    .eq("handle", handle)
    .single();

  if (!league) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <div className="text-4xl mb-3">🔍</div>
        <div className="display text-xl mb-2">Aucune ligue ici.</div>
        <p className="text-[var(--text-faint)] text-sm">
          Vérifie le lien — ou peut-être qu&apos;elle n&apos;existe pas encore.
        </p>
      </div>
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: memberRows } = await supabase
    .from("league_members")
    .select("user_id, joined_at")
    .eq("league_id", league.id);

  const memberIds = (memberRows || []).map((m) => m.user_id);
  const isMember = !!user && memberIds.includes(user.id);
  const isOwner = !!user && user.id === league.owner_id;

  let standings = [];
  if (memberIds.length > 0) {
    const { data } = await supabase
      .from("user_totals")
      .select("*")
      .in("user_id", memberIds)
      .order("total_score", { ascending: false });
    standings = data || [];
  }

  const full = league.member_cap ? memberIds.length >= league.member_cap : false;
  const socials = SOCIALS.filter(([key]) => league[key]);

  return (
    <div className="min-h-screen pb-16">
      {/* YouTube-style header: banner (image or gradient fallback) + avatar
          overlapping bottom-left + name/tagline/socials below, his territory */}
      <div
        className="w-full aspect-[3/1] max-h-56"
        style={{
          background: league.banner_url
            ? `center / cover no-repeat url(${league.banner_url})`
            : `linear-gradient(135deg, ${league.color_primary}, ${league.color_secondary})`,
        }}
      />

      <div className="px-5 max-w-md mx-auto">
        <div className="flex items-end gap-3 -mt-8 mb-3">
          <div
            className="w-16 h-16 rounded-full border-4 border-[var(--bg)] overflow-hidden flex-shrink-0 flex items-center justify-center text-lg font-extrabold text-white"
            style={{ background: league.color_secondary }}
          >
            {league.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={league.avatar_url} alt={league.name} className="w-full h-full object-cover" />
            ) : (
              league.name.slice(0, 2).toUpperCase()
            )}
          </div>
          <div className="pb-1">
            <div className="text-[10px] uppercase tracking-wide text-[var(--text-faint)] font-bold">
              Ligue privée
            </div>
            <div className="display text-xl leading-tight">{league.name}</div>
          </div>
        </div>

        {league.tagline && <p className="text-[var(--text-muted)] text-sm mb-3">{league.tagline}</p>}
        {socials.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-5">
            {socials.map(([key, label]) => (
              <a
                key={key}
                href={league[key]}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-bold rounded-full px-3 py-1.5 text-white"
                style={{ background: league.color_primary }}
              >
                {label}
              </a>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between mb-5">
          <div className="text-[13px] uppercase tracking-wide text-[var(--text-faint)] font-bold">
            {memberIds.length} membre{memberIds.length > 1 ? "s" : ""}
            {league.member_cap ? ` / ${league.member_cap}` : ""}
          </div>
          {full && <span className="text-xs text-[var(--crimson)] font-bold">Complet</span>}
        </div>

        <LeagueActions
          league={{ id: league.id, handle: league.handle, invite_code: league.invite_code }}
          isLoggedIn={!!user}
          isOwner={isOwner}
          isMember={isMember}
          full={full}
        />

        <div className="text-[13px] uppercase tracking-wide text-[var(--text-faint)] font-bold mb-3 mt-8">
          Classement de la ligue
        </div>
        {standings.length === 0 && (
          <div className="text-center text-[var(--text-faint)] text-sm py-6">
            Personne n&apos;a encore rejoint — sois le premier.
          </div>
        )}
        {standings.map((r, i) => (
          <div
            key={r.user_id}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl mb-1.5 border ${
              user && r.user_id === user.id
                ? "border-2"
                : "border-[var(--border)]"
            }`}
            style={user && r.user_id === user.id ? { borderColor: league.color_primary } : {}}
          >
            <div className="w-6 text-center mono text-[var(--text-faint)] text-sm">{i + 1}</div>
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 text-white"
              style={{ background: league.color_secondary }}
            >
              {r.username.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold">
                {r.username}
                {r.user_id === league.owner_id && (
                  <span className="text-[10px] text-[var(--text-faint)]"> · créateur</span>
                )}
                {user && r.user_id === user.id ? " (toi)" : ""}
              </div>
            </div>
            <div className="mono text-sm font-bold">{r.total_score} pts</div>
          </div>
        ))}
      </div>
    </div>
  );
}
