"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getWeeklyProgram, formatCountdown, nextPhaseRoute } from "@/lib/weeklyProgram";

const PHASE_LABEL = {
  team: "🧢 Capitaine & transfert",
  predictions: "🔮 Pronostics & actu",
};

// Always-populated, never blank — the "no man's land" fix. Shows whichever
// communal window is open right now, or a countdown to the next one. State
// is only ever written from a setTimeout/setInterval callback, never
// synchronously in the effect body.
export default function WeeklyBanner({ bilanReady }) {
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
  const label = isOpen ? PHASE_LABEL[program.phase] : PHASE_LABEL[program.nextPhase];

  return (
    <div className="mx-4 mb-3 flex items-center gap-2">
      <Link
        href={href}
        className={`flex-1 flex items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-bold ${
          isOpen
            ? "bg-[var(--gold-soft)] border border-[var(--gold)] text-[var(--gold)]"
            : "bg-[var(--surface)] border border-[var(--border)] text-[var(--text-muted)]"
        }`}
      >
        <span>{label}</span>
        <span className="mono">
          {isOpen ? `ferme dans ${countdown}` : `dans ${countdown}`}
        </span>
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
