"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [mode, setMode] = useState("signin"); // 'signin' | 'signup'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } =
      mode === "signup"
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
      <div className="display text-4xl mb-1">
        LABEL<span className="text-[var(--gold)]">.</span>
      </div>
      <p className="text-[var(--text-muted)] text-sm mb-8 max-w-xs">
        Draft de vrais artistes de rap français. Leur cote bouge avec leurs vrais coups d&apos;éclat.
      </p>

      <form onSubmit={handleSubmit} className="w-full max-w-xs space-y-3">
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[var(--gold)]"
        />
        <input
          type="password"
          required
          minLength={6}
          placeholder="Mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[var(--gold)]"
        />
        {error && <p className="text-[var(--crimson)] text-xs">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[var(--gold)] text-[#1a1310] font-extrabold uppercase tracking-wide text-sm rounded-xl py-3 disabled:opacity-60"
        >
          {loading ? "..." : mode === "signup" ? "Créer mon compte" : "Se connecter"}
        </button>
      </form>

      <button
        onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
        className="text-xs text-[var(--text-faint)] mt-5 underline"
      >
        {mode === "signup" ? "Déjà un compte ? Se connecter" : "Pas de compte ? S'inscrire"}
      </button>
    </div>
  );
}
