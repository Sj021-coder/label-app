"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import VinylAvatar from "@/components/VinylAvatar";

export default function DraftList({ artists, initialRosterIds }) {
  const [rosterIds, setRosterIds] = useState(initialRosterIds);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  async function toggle(artistId) {
    setError("");
    const has = rosterIds.includes(artistId);

    if (has) {
      const res = await fetch("/api/roster", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artistId }),
      });
      if (res.ok) {
        setRosterIds((prev) => prev.filter((id) => id !== artistId));
        startTransition(() => router.refresh());
      }
    } else {
      if (rosterIds.length >= 5) return;
      const res = await fetch("/api/roster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artistId }),
      });
      if (res.ok) {
        setRosterIds((prev) => [...prev, artistId]);
        startTransition(() => router.refresh());
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Erreur");
      }
    }
  }

  return (
    <div>
      {error && <p className="text-[var(--crimson)] text-xs mb-2">{error}</p>}
      {artists.map((a) => {
        const has = rosterIds.includes(a.id);
        const full = rosterIds.length >= 5 && !has;
        return (
          <div
            key={a.id}
            className="flex items-center gap-3 bg-[var(--surface)] border border-[var(--border)] rounded-2xl px-3 py-2.5 mb-2"
          >
            <VinylAvatar initials={a.initials} color={a.color} size={42} />
            <div className="flex-1">
              <div className="text-sm font-bold">{a.name}</div>
              <div className="mono text-xs text-[var(--text-muted)]">{a.score} pts</div>
            </div>
            <button
              disabled={full || pending}
              onClick={() => toggle(a.id)}
              className={`text-xs font-bold px-3.5 py-1.5 rounded-full ${
                has
                  ? "bg-[var(--surface-2)] text-[var(--text-muted)] border border-[var(--border)]"
                  : full
                  ? "bg-[var(--surface-2)] text-[var(--text-faint)]"
                  : "bg-[var(--gold)] text-[#1a1310]"
              }`}
            >
              {has ? "Retirer" : full ? "Complet" : "+ Ajouter"}
            </button>
          </div>
        );
      })}
    </div>
  );
}
