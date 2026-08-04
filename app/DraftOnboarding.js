"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import VinylAvatar from "@/components/VinylAvatar";

export default function DraftOnboarding({ artists }) {
  const [step, setStep] = useState(1); // 1 = pick artists, 2 = pseudo
  const [selected, setSelected] = useState([]);
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();

  function toggle(id) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 5) return prev;
      return [...prev, id];
    });
  }

  async function handleValidate(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    // 1. Create an anonymous account (no email/password needed)
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

    // 2. Create the public profile (pseudo)
    const { error: profileError } = await supabase
      .from("profiles")
      .insert({ id: user.id, username: username.trim() });

    if (profileError) {
      setLoading(false);
      setError(
        profileError.code === "23505"
          ? "Ce pseudo est déjà pris."
          : profileError.message
      );
      return;
    }

    // 3. Save the roster picks made in step 1
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
      <div className="px-4 pb-10">
        <div className="text-center pt-6 pb-5">
          <div className="display text-3xl mb-1">
            LABEL<span className="text-[var(--gold)]">.</span>
          </div>
          <p className="text-[var(--text-muted)] text-sm max-w-xs mx-auto">
            Choisis jusqu&apos;à 5 artistes. Leur cote bougera avec leurs vrais
            coups d&apos;éclat.
          </p>
        </div>

        <div className="text-[13px] uppercase tracking-wide text-[var(--text-faint)] font-bold mb-3">
          Sélectionne ton roster ({selected.length}/5)
        </div>

        <div className="grid grid-cols-3 gap-2.5 mb-24">
          {artists.map((a) => {
            const isSelected = selected.includes(a.id);
            const full = selected.length >= 5 && !isSelected;
            return (
              <button
                key={a.id}
                onClick={() => toggle(a.id)}
                disabled={full}
                className={`text-left bg-[var(--surface)] border rounded-2xl p-2.5 transition ${
                  isSelected
                    ? "border-[var(--gold)]"
                    : full
                    ? "border-[var(--border)] opacity-40"
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
                <div className="text-xs font-bold mb-1 leading-tight">{a.name}</div>
                <div className="mono text-[11px] text-[var(--text-muted)]">
                  {a.score} pts
                </div>
              </button>
            );
          })}
        </div>

        <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto px-4 pb-6 pt-3 bg-gradient-to-t from-[var(--bg)] via-[var(--bg)] to-transparent">
          <button
            onClick={() => setStep(2)}
            disabled={selected.length === 0}
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
      <p className="text-[var(--text-muted)] text-sm mb-7 max-w-xs">
        Choisis un pseudo pour sauvegarder ton roster de {selected.length} artiste
        {selected.length > 1 ? "s" : ""}. Pas d&apos;email, pas de mot de passe.
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
          {loading ? "..." : "Valider mon roster"}
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
