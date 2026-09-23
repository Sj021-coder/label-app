"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getWeeklyProgram, formatCountdown, nextPhaseRoute } from "@/lib/weeklyProgram";

// Identity-driven, not utility-driven: "un patron de label..." rather than
// "n'oublie pas de...". One headline per phase x open/closed — the fact
// line underneath (from the server, real data) is what actually varies
// week to week.
const HEADLINE = {
  team: { open: "🧢 Aux commandes de ton label", closed: "🧢 Gestion du label" },
  predictions: { open: "🔮 Le pari du patron", closed: "🔮 Pronostics" },
};

// Distinct per phase on purpose — the banner should be recognizable at a
// glance before anyone reads a word of it (gold = ton équipe, violet = le
// reste du game). Quiet stretches stay neutral, they're not a call to action.
const PHASE_STYLE = {
  team: "bg-[var(--gold-soft)] border-[var(--gold)] text-[var(--gold)]",
  predictions: "bg-[var(--violet)]/10 border-[var(--violet)] text-[var(--violet)]",
  quiet: "bg-[var(--surface)] border-[var(--border)] text-[var(--text-muted)]",
};

// Always-populated, never blank — the "no man's land" fix. Shows whichever
// communal window is open right now, or a countdown to the next one. State
// is only ever written from a setTimeout/setInterval callback, never
// synchronously in the effect body.
export default function WeeklyBanner({ bilanReady, fact }) {
  const [program, setProgram] = useState(null);
  const [countdown, setCountdown] = useState("…");

  useEffect(() => {
    function tick() {
      const p = getWeeklyProgram();
      setProgram(p);
      setCountdown(formatCountdown(p.closesAt || p.nextAt));
    }
    const t0 = setTimeout(tick, 0);
    const id = setInterval(tick, 30000);
    return () => {
      clearTimeout(t0);
      clearInterval(id);
    };
  }, []);

  if (!program) {
    return <div className="mx-4 mb-3 h-11 rounded-xl bg-[var(--surface)] animate-pulse" />;
  }

  const isOpen = program.phase !== "quiet";
  const targetPhase = isOpen ? program.phase : program.nextPhase;
  const href = nextPhaseRoute(targetPhase);
  const headline = HEADLINE[targetPhase]?.[isOpen ? "open" : "closed"] || "Programme de la semaine";
  const styleKey = isOpen ? program.phase : "quiet";

  return (
    <div className="mx-4 mb-3 flex items-center gap-2">
      <Link
        href={href}
        className={`flex-1 rounded-xl px-3.5 py-2.5 text-xs font-bold border ${PHASE_STYLE[styleKey]}`}
      >
        <div className="flex items-center justify-between">
          <span>{headline}</span>
          <span className="mono font-normal opacity-80">
            {isOpen ? `ferme dans ${countdown}` : `dans ${countdown}`}
          </span>
        </div>
        {/* Real fact only, never invented — silently omitted if none exists
            for this user/week yet (new account, quiet pool). */}
        {isOpen && fact && (
          <div className="mt-1 text-[11px] font-normal opacity-90">{fact}</div>
        )}
      </Link>
      {bilanReady && (
        <Link
          href="/bilan"
          className="flex-shrink-0 text-xs font-bold text-[var(--violet)] bg-[var(--surface)] border border-[var(--violet)] rounded-xl px-3 py-2.5"
        >
          📊 Bilan
        </Link>
      )}
    </div>
  );
}
