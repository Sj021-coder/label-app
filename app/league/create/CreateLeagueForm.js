"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function slugify(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 24);
}

function randomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export default function CreateLeagueForm({ suggestedName }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [name, setName] = useState(suggestedName);
  // null = still following the name; once the creator edits it directly,
  // it detaches and holds their exact value — no effect needed to sync it.
  const [handleOverride, setHandleOverride] = useState(null);
  const handle = handleOverride ?? slugify(name);
  const [colorPrimary, setColorPrimary] = useState("#dda63a");
  const [colorSecondary, setColorSecondary] = useState("#8a6cff");
  const [tagline, setTagline] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [twitchUrl, setTwitchUrl] = useState("");
  const [tiktokUrl, setTiktokUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [avail, setAvail] = useState(null); // { handle, taken }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (handle.length < 2) return;
    let active = true;
    const t = setTimeout(async () => {
      const { data } = await supabase.from("leagues").select("id").eq("handle", handle).limit(1);
      if (active) setAvail({ handle, taken: !!(data && data.length) });
    }, 300);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [handle, supabase]);

  const availStatus =
    handle.length < 2 ? null : avail && avail.handle === handle ? (avail.taken ? "taken" : "free") : "checking";

  async function createLeague(e) {
    e.preventDefault();
    setError("");
    if (availStatus === "taken" || !name.trim() || handle.length < 2) return;
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: league, error: insErr } = await supabase
      .from("leagues")
      .insert({
        handle,
        name: name.trim(),
        owner_id: user.id,
        color_primary: colorPrimary,
        color_secondary: colorSecondary,
        tagline: tagline.trim() || null,
        youtube_url: youtubeUrl.trim() || null,
        twitch_url: twitchUrl.trim() || null,
        tiktok_url: tiktokUrl.trim() || null,
        instagram_url: instagramUrl.trim() || null,
        invite_code: randomCode(),
      })
      .select("id")
      .single();

    if (insErr) {
      setLoading(false);
      setError(insErr.code === "23505" ? "Ce lien est déjà pris." : insErr.message);
      return;
    }

    // The owner is a member of their own league too — shows up in the
    // leaderboard, "beatable roster" from day one.
    await supabase.from("league_members").insert({ league_id: league.id, user_id: user.id });
    setLoading(false);
    router.push(`/league/${handle}`);
    router.refresh();
  }

  return (
    <div className="min-h-screen px-5 pt-8 pb-10 max-w-md mx-auto">
      <div className="display text-2xl mb-1">Crée ta ligue.</div>
      <p className="text-[var(--text-muted)] text-sm mb-7">
        Ton territoire, ton lien, tes couleurs. Tes membres jouent le même jeu — juste
        classés entre eux.
      </p>

      <form onSubmit={createLeague} className="space-y-4">
        <div>
          <label className="text-[10px] uppercase tracking-wide text-[var(--text-faint)] font-bold block mb-1">
            Nom de la ligue
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-[var(--gold)]"
          />
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-wide text-[var(--text-faint)] font-bold block mb-1">
            Ton lien
          </label>
          <div className="flex items-center bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3.5 py-2.5 focus-within:border-[var(--gold)]">
            <span className="text-[var(--text-faint)] text-sm">ligue.label.app/</span>
            <input
              type="text"
              value={handle}
              onChange={(e) => setHandleOverride(slugify(e.target.value))}
              className="flex-1 bg-transparent focus:outline-none text-sm"
            />
          </div>
          <div className="h-4 mt-1 text-xs">
            {availStatus === "checking" && <span className="text-[var(--text-faint)]">Vérification…</span>}
            {availStatus === "free" && <span className="text-[var(--gold)]">✓ Disponible</span>}
            {availStatus === "taken" && <span className="text-[var(--crimson)]">Déjà pris</span>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] uppercase tracking-wide text-[var(--text-faint)] font-bold block mb-1">
              Couleur 1
            </label>
            <input
              type="color"
              value={colorPrimary}
              onChange={(e) => setColorPrimary(e.target.value)}
              className="w-full h-10 bg-[var(--surface)] border border-[var(--border)] rounded-xl"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wide text-[var(--text-faint)] font-bold block mb-1">
              Couleur 2
            </label>
            <input
              type="color"
              value={colorSecondary}
              onChange={(e) => setColorSecondary(e.target.value)}
              className="w-full h-10 bg-[var(--surface)] border border-[var(--border)] rounded-xl"
            />
          </div>
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-wide text-[var(--text-faint)] font-bold block mb-1">
            Ta phrase (optionnel)
          </label>
          <input
            type="text"
            maxLength={80}
            placeholder="Bienvenue dans le cercle."
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-[var(--gold)]"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-wide text-[var(--text-faint)] font-bold block">
            Tes réseaux (optionnel)
          </label>
          {[
            ["📺 YouTube", youtubeUrl, setYoutubeUrl],
            ["🟣 Twitch", twitchUrl, setTwitchUrl],
            ["🎵 TikTok", tiktokUrl, setTiktokUrl],
            ["📸 Instagram", instagramUrl, setInstagramUrl],
          ].map(([label, val, setter]) => (
            <input
              key={label}
              type="url"
              placeholder={`${label} — lien complet`}
              value={val}
              onChange={(e) => setter(e.target.value)}
              className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-[var(--gold)]"
            />
          ))}
        </div>

        {error && <p className="text-[var(--crimson)] text-xs">{error}</p>}

        <button
          type="submit"
          disabled={loading || availStatus === "taken" || !name.trim() || handle.length < 2}
          className="w-full bg-[var(--gold)] text-[#1a1310] font-extrabold uppercase tracking-wide text-sm rounded-xl py-3.5 disabled:opacity-40"
        >
          {loading ? "…" : "Créer ma ligue"}
        </button>
      </form>
    </div>
  );
}
