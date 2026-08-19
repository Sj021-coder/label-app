"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function slugify(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 24);
}

function randomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

const COLORS = ["#8a6cff", "#dda63a", "#e8455f", "#3aa6dd", "#6cd98a", "#dd7a3a"];

export default function TeamCreateForm({ suggestedName }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [name, setName] = useState(suggestedName);
  const [handleOverride, setHandleOverride] = useState(null);
  const handle = handleOverride ?? slugify(name);
  const [color, setColor] = useState(COLORS[0]);
  const [avail, setAvail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (handle.length < 2) return;
    let active = true;
    const t = setTimeout(async () => {
      const { data } = await supabase.from("teams").select("id").eq("handle", handle).limit(1);
      if (active) setAvail({ handle, taken: !!(data && data.length) });
    }, 300);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [handle, supabase]);

  const availStatus =
    handle.length < 2 ? null : avail && avail.handle === handle ? (avail.taken ? "taken" : "free") : "checking";

  async function createTeam(e) {
    e.preventDefault();
    setError("");
    if (availStatus === "taken" || !name.trim() || handle.length < 2) return;
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: team, error: insErr } = await supabase
      .from("teams")
      .insert({ handle, name: name.trim(), owner_id: user.id, color, invite_code: randomCode() })
      .select("id")
      .single();

    if (insErr) {
      setLoading(false);
      setError(insErr.code === "23505" ? "Ce lien est déjà pris." : insErr.message);
      return;
    }

    await supabase.from("team_members").insert({ team_id: team.id, user_id: user.id });
    setLoading(false);
    router.push(`/team/${handle}`);
    router.refresh();
  }

  return (
    <div className="min-h-screen px-5 pt-8 pb-10 max-w-md mx-auto">
      <div className="display text-2xl mb-1">Crée ton équipe.</div>
      <p className="text-[var(--text-muted)] text-sm mb-7">
        Pas un classement — une équipe. Ce que fait chaque membre compte pour tout le
        monde. Jusqu&apos;à 20 personnes.
      </p>

      <form onSubmit={createTeam} className="space-y-4">
        <div>
          <label className="text-[10px] uppercase tracking-wide text-[var(--text-faint)] font-bold block mb-1">
            Nom de l&apos;équipe
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
            <span className="text-[var(--text-faint)] text-sm">team.label.app/</span>
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

        <div>
          <label className="text-[10px] uppercase tracking-wide text-[var(--text-faint)] font-bold block mb-2">
            Couleur d&apos;équipe
          </label>
          <div className="flex gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-9 h-9 rounded-full border-2 ${color === c ? "border-white" : "border-transparent"}`}
                style={{ background: c }}
                aria-label={c}
              />
            ))}
          </div>
        </div>

        {error && <p className="text-[var(--crimson)] text-xs">{error}</p>}

        <button
          type="submit"
          disabled={loading || availStatus === "taken" || !name.trim() || handle.length < 2}
          className="w-full bg-[var(--gold)] text-[#1a1310] font-extrabold uppercase tracking-wide text-sm rounded-xl py-3.5 disabled:opacity-40"
        >
          {loading ? "…" : "Créer mon équipe"}
        </button>
      </form>
    </div>
  );
}
