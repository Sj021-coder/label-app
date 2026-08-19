"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function TeamActions({ team, isLoggedIn, isOwner, isMember, full }) {
  const router = useRouter();
  const supabase = createClient();
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/team/${team.handle}` : "";

  async function join() {
    setError("");
    setJoining(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error: joinErr } = await supabase
      .from("team_members")
      .insert({ team_id: team.id, user_id: user.id });
    setJoining(false);
    if (joinErr) {
      setError(joinErr.message?.includes("full") ? "L'équipe est complète (20 max)." : "Impossible de rejoindre.");
      return;
    }
    router.refresh();
  }

  function copyLink() {
    navigator.clipboard?.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (isOwner || isMember) {
    return (
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 mb-4">
        <div className="text-[11px] uppercase tracking-wide text-[var(--text-faint)] font-bold mb-2">
          Inviter des potes
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 mono text-xs bg-[var(--surface-2)] rounded-lg px-3 py-2.5 truncate">
            {shareUrl || `/team/${team.handle}`}
          </div>
          <button
            onClick={copyLink}
            className="text-xs font-bold text-[#1a1310] bg-[var(--gold)] rounded-lg px-3 py-2.5 whitespace-nowrap"
          >
            {copied ? "Copié ✓" : "Copier"}
          </button>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 text-center mb-4">
        <p className="text-sm text-[var(--text-muted)] mb-3">
          Compose ton label d&apos;abord — reviens ensuite sur ce lien pour rejoindre l&apos;équipe.
        </p>
        <Link
          href="/"
          className="inline-block bg-[var(--gold)] text-[#1a1310] font-extrabold uppercase tracking-wide text-sm rounded-xl py-3 px-6"
        >
          Composer mon label
        </Link>
      </div>
    );
  }

  if (full) {
    return <div className="text-center text-sm text-[var(--crimson)] font-bold py-2 mb-4">Équipe complète (20/20).</div>;
  }

  return (
    <div className="mb-4">
      <button
        onClick={join}
        disabled={joining}
        className="w-full bg-[var(--gold)] text-[#1a1310] font-extrabold uppercase tracking-wide text-sm rounded-xl py-3.5 disabled:opacity-60"
      >
        {joining ? "…" : "Rejoindre l'équipe"}
      </button>
      {error && <p className="text-[var(--crimson)] text-xs text-center mt-2">{error}</p>}
    </div>
  );
}
