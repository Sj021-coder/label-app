"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import VinylAvatar from "@/components/VinylAvatar";
import {
  BUDGET_TOTAL,
  ROSTER_SIZE,
  TIERS,
  meetsDiversityRule,
  totalCost,
} from "@/lib/gameRules";

export default function DraftOnboarding({ artists }) {
  const [step, setStep] = useState(1); // 1 = pick artists, 2 = pseudo
  const [selected, setSelected] = useState([]);
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();

  const selectedArtists = useMemo(
    () => artists.filter((a) => selected.includes(a.id)),
    [artists, selected]
  );
  const spent = totalCost(selectedArtists);
  const remaining = BUDGET_TOTAL - spent;
  const hasDiversity = meetsDiversityRule(selectedArtists);
  const canContinue =
    selected.length > 0 && selected.length <= ROSTER_SIZE && hasDiversity;

  function toggle(artist) {
    setSelected((prev) => {
      const isSelected = prev.includes(artist.id);
      if (isSelected) return prev.filter((x) => x !== artist.id);
      if (prev.length >= ROSTER_SIZE) return prev;
      const wouldSpend = spent + artist.cost;
      if (wouldSpend > BUDGET_TOTAL) return prev;
      return [...prev, artist.id];
    });
  }

  async function handleValidate(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { data: signInData, error: signInError } =
      await supabase.auth.signInAnonymously();

    if (signInError) {
      setLoading(false);
      setError(
        "Impossible de créer un compte. (Vérifie que 'Anonymous Sign-ins' est activé dans Supabase.)"
      );
      return;
    }

    const user = signInData.user;

    const { error: profileError } = await supabase
      .from("profiles")
      .insert({ id: user.id, username: username.trim() });

    if (profileError) {
      setLoading(false);
      setError(
        profileError.code === "23505" ? "Ce pseudo est déjà pris." : profileError.message
      );
      return;
    }

    const rows = selected.map((artistId) => ({
      user_id: user.id,
      artist_id: artistId,
    }));
    const { error: rosterError } = await supabase
      .from("roster_entries")
      .insert(rows);

    setLoading(false);
    if (rosterError) {
      setError(rosterError.message);
      return;
    }

    router.push("/roster");
    router.refresh();
  }

  if (step === 1) {
    return (
      <div className="px-4 pb-28">
        <div className="text-center pt-6 pb-4">
          <div className="display text-3xl mb-1">
            LABEL<span className="text-[var(--gold)]">.</span>
          </div>
          <p className="text-[var(--text-muted)] text-sm max-w-xs mx-auto">
            100M à dépenser. 7 artistes max. Au moins 1 Rising/Emerging obligatoire.
          </p>
        </div>

        {/* Budget bar */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl px-4 py-3 mb-4 sticky top-2 z-10">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[11px] uppercase tracking-wide text-[var(--text-faint)] font-bold">
              Budget
            </span>
            <span className="mono text-sm font-bold">
              {remaining}M <span className="text-[var(--text-faint)] font-normal">/ {BUDGET_TOTAL}M</span>
            </span>
          </div>
          <div className="h-2 bg-[var(--surface-2)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--gold)] transition-all"
              style={{ width: `${Math.min(100, (spent / BUDGET_TOTAL) * 100)}%` }}
            />
          </div>
          <div className="flex justify-between items-center mt-2">
            <span className="text-xs text-[var(--text-faint)]">
              {selected.length}/{ROSTER_SIZE} artistes
            </span>
            {!hasDiversity && selected.length > 0 && (
              <span className="text-xs text-[var(--crimson)]">
                Ajoute 1 artiste ⭐⭐ ou ⭐
              </span>
            )}
            {hasDiversity && (
              <span className="text-xs text-[var(--gold)]">✓ Règle diversité OK</span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          {artists.map((a) => {
            const isSelected = selected.includes(a.id);
            const full = selected.length >= ROSTER_SIZE && !isSelected;
            const tooExpensive = !isSelected && a.cost > remaining;
            const disabled = full || tooExpensive;
            return (
              <button
                key={a.id}
                onClick={() => toggle(a)}
                disabled={disabled}
                className={`text-left bg-[var(--surface)] border rounded-2xl p-2.5 transition ${
                  isSelected
                    ? "border-[var(--gold)]"
                    : disabled
                    ? "border-[var(--border)] opacity-35"
                    : "border-[var(--border)]"
                }`}
              >
                <div className="mb-2 relative">
                  <VinylAvatar initials={a.initials} color={a.color} size={"100%"} />
                  {isSelected && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[var(--gold)] text-[#1a1310] text-xs font-bold flex items-center justify-center">
                      ✓
                    </div>
                  )}
                </div>
                <div className="text-xs font-bold mb-0.5 leading-tight">{a.name}</div>
                <div className="text-[10px] text-[var(--text-faint)] mb-1">
                  {TIERS[a.tier]?.stars}
                </div>
                <div className="mono text-[11px] font-bold text-[var(--gold)]">
                  {a.cost}M
                </div>
              </button>
            );
          })}
        </div>

        <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto px-4 pb-6 pt-3 bg-gradient-to-t from-[var(--bg)] via-[var(--bg)] to-transparent">
          <button
            onClick={() => setStep(2)}
            disabled={!canContinue}
            className="w-full bg-[var(--gold)] text-[#1a1310] font-extrabold uppercase tracking-wide text-sm rounded-xl py-3.5 disabled:opacity-40"
          >
            Continuer ({selected.length} sélectionné{selected.length > 1 ? "s" : ""})
          </button>
        </div>
      </div>
    );
  }

  // Step 2: pseudo + validate
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
      <div className="display text-3xl mb-2 leading-tight">
        Presque
        <br />
        <span className="text-[var(--gold)]">Prêt.</span>
      </div>
      <p className="text-[var(--text-muted)] text-sm mb-2 max-w-xs">
        Choisis un pseudo pour sauvegarder ton label de {selected.length} artiste
        {selected.length > 1 ? "s" : ""} ({spent}M dépensés).
      </p>
      <p className="text-[var(--text-faint)] text-xs mb-7">
        Pas d&apos;email, pas de mot de passe.
      </p>
      <form onSubmit={handleValidate} className="w-full max-w-xs space-y-3">
        <input
          type="text"
          required
          maxLength={24}
          placeholder="Ton pseudo"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full text-center bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[var(--gold)]"
        />
        {error && <p className="text-[var(--crimson)] text-xs">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[var(--gold)] text-[#1a1310] font-extrabold uppercase tracking-wide text-sm rounded-xl py-3 disabled:opacity-60"
        >
          {loading ? "..." : "Valider mon label"}
        </button>
        <button
          type="button"
          onClick={() => setStep(1)}
          className="text-xs text-[var(--text-faint)] underline"
        >
          ← Modifier ma sélection
        </button>
      </form>
    </div>
  );
}
