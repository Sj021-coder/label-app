"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import ArtistFace from "@/components/ArtistFace";

// The "trading ticker" treatment, applied to Radar's value movers — same
// pattern already proven on Roster (RosterClient.js): a real write lands
// on screen with a visible flash + a floating +/- number, not just a
// silent number swap. Overrides layered on top of the server-fetched
// list (not copied into state) so there's no stale-prop-sync effect.
//
// One real limitation, on purpose: if a NEW artist's value just moved
// enough to enter the top-8 list, this component can't add a row that
// wasn't in its initial props. The page's own <LiveRefresh> handles that
// — it silently re-fetches the correct, reordered list ~800ms later. So
// what the user sees is: instant flash on movers already visible, then a
// clean reorder shortly after if the list itself needed to change.
export default function LiveValueMovers({ movers }) {
  const [overrides, setOverrides] = useState({});
  const [flashId, setFlashId] = useState(null);
  const [deltaFlash, setDeltaFlash] = useState(null); // { id, delta, key }
  const flashSeq = useRef(0);
  const supabase = useMemo(() => createClient(), []);

  const liveMovers = movers.map((m) => (overrides[m.id] ? { ...m, ...overrides[m.id] } : m));

  useEffect(() => {
    const ids = movers.map((m) => m.id);
    if (!ids.length) return;

    const channel = supabase
      .channel("radar-value-ticker")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "artists" },
        (payload) => {
          const updated = payload.new;
          const before = payload.old;
          if (!ids.includes(updated.id)) return;

          setOverrides((prev) => ({
            ...prev,
            [updated.id]: { value: updated.value, cost: updated.cost, value_reason: updated.value_reason },
          }));

          const delta = (updated.value ?? 0) - (before?.value ?? updated.value ?? 0);
          setFlashId(updated.id);
          if (delta !== 0) {
            setDeltaFlash({ id: updated.id, delta, key: (flashSeq.current += 1) });
          }
          setTimeout(() => setFlashId((cur) => (cur === updated.id ? null : cur)), 1000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [movers, supabase]);

  return (
    <>
      {liveMovers.map((a) => {
        const up = a.value > (a.cost || a.value);
        return (
          <div
            key={a.id}
            className={`flex items-center gap-3 bg-[var(--surface)] border rounded-2xl px-3.5 py-3 mb-2.5 relative transition-shadow ${
              flashId === a.id ? "live-flash" : "border-[var(--border)]"
            }`}
          >
            {deltaFlash?.id === a.id && (
              <span
                key={deltaFlash.key}
                className={`float-delta absolute top-1 right-1 mono text-xs font-bold z-10 ${
                  deltaFlash.delta > 0 ? "text-[var(--gold)]" : "text-[var(--crimson)]"
                }`}
              >
                {deltaFlash.delta > 0 ? "+" : ""}
                {deltaFlash.delta}M
              </span>
            )}
            <ArtistFace imageUrl={a.image_url} initials={a.initials} color={a.color} name={a.name} size={40} />
            <div className="flex-1">
              <div className="text-xs font-bold mb-0.5">{a.name}</div>
              <div className="text-[13px] text-[var(--text-muted)]">{a.value_reason}</div>
            </div>
            <div
              className={`mono text-xs font-bold whitespace-nowrap ${
                up ? "text-[var(--gold)]" : "text-[var(--crimson)]"
              }`}
            >
              {up ? "▲" : "▼"} {a.value}M
            </div>
          </div>
        );
      })}
    </>
  );
}
