"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// TEMPORARY, pre-launch only — see lib/supabase/admin.js. Any logged-in
// account can unlock admin with the shared code, once per device.
export default function AdminCodeGate() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/admin/enter-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Code incorrect.");
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-xs space-y-2 mt-4">
      <input
        type="text"
        inputMode="numeric"
        placeholder="Code d'accès"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        className="w-full text-center bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[var(--gold)]"
      />
      {error && <p className="text-[var(--crimson)] text-xs">{error}</p>}
      <button
        type="submit"
        disabled={loading || !code}
        className="w-full bg-[var(--gold)] text-[#1a1310] font-extrabold uppercase tracking-wide text-sm rounded-xl py-3 disabled:opacity-60"
      >
        {loading ? "..." : "Entrer"}
      </button>
    </form>
  );
}
