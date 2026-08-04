"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function OnboardingPage() {
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .insert({ id: user.id, username: username.trim() });

    setLoading(false);
    if (error) {
      setError(
        error.code === "23505" ? "Ce nom de label est déjà pris." : error.message
      );
      return;
    }
    router.push("/roster");
    router.refresh();
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
      <div className="display text-3xl mb-2 leading-tight">
        Ton Label,
        <br />
        <span className="text-[var(--gold)]">Ton Empire</span>
      </div>
      <p className="text-[var(--text-muted)] text-sm mb-7 max-w-xs">
        Choisis un nom de label public. C&apos;est ce que les autres verront sur le classement.
      </p>
      <form onSubmit={handleSubmit} className="w-full max-w-xs space-y-3">
        <input
          type="text"
          required
          maxLength={24}
          placeholder="Nom de ton label"
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
          {loading ? "..." : "Créer mon label"}
        </button>
      </form>
    </div>
  );
}
