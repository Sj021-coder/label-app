"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { captureContext, logEvent } from "@/lib/onboarding/tracking";
import { isReservedAdminPseudo } from "@/lib/adminPseudos";
import { BUDGET_TOTAL, ROSTER_SIZE, meetsDiversityRule } from "@/lib/gameRules";

// ---------------------------------------------------------------------------
// Helpers (pure)
// ---------------------------------------------------------------------------

// Fill remaining slots with a valid roster (<=100M, <=7, >=1 Tier B/C),
// starting from the current selection. Powers "Complète pour moi".
function completeRoster(pool, startIds) {
  const byId = Object.fromEntries(pool.map((a) => [a.id, a]));
  const selected = [...startIds];
  const minCost = Math.min(...pool.map((a) => a.cost || 1));
  const spentOf = (ids) => ids.reduce((s, id) => s + (byId[id]?.cost || 0), 0);
  const hasBC = (ids) => ids.some((id) => ["B", "C"].includes(byId[id]?.tier));
  const rand = (arr) => (arr.length ? arr[Math.floor(Math.random() * arr.length)] : null);

  while (selected.length < ROSTER_SIZE) {
    const slotsAfter = ROSTER_SIZE - selected.length - 1;
    const budgetLeft = BUDGET_TOTAL - spentOf(selected);
    const affordable = (a) =>
      !selected.includes(a.id) && (a.cost || 0) <= budgetLeft - slotsAfter * minCost;
    const needBC = slotsAfter === 0 && !hasBC(selected);
    let cands = pool.filter((a) => affordable(a) && (!needBC || ["B", "C"].includes(a.tier)));
    if (!cands.length) cands = pool.filter((a) => affordable(a));
    const pick = rand(cands);
    if (!pick) break;
    selected.push(pick.id);
  }
  return selected;
}

// A light, honest one-liner per artist — never a stats block, never a zero.
function contextLine(a) {
  if (a.value != null && a.cost && a.value !== a.cost) {
    const pct = Math.round(((a.value - a.cost) / a.cost) * 100);
    if (pct > 0) return { text: `+${pct}% cette semaine`, tone: "up" };
    if (pct < 0) return { text: `${pct}% cette semaine`, tone: "down" };
  }
  const labels = { S: "Superstar", A: "Valeur sûre", B: "Qui monte", C: "Pépite" };
  return { text: labels[a.tier] || "Artiste", tone: "muted" };
}

// A single divisive, auto-generated stat for the unsigned card (S3).
function divisiveStat(picked) {
  if (!picked.length) return "Un label comme personne.";
  const priciest = picked.reduce((m, a) => (a.cost > m.cost ? a : m), picked[0]);
  const sCount = picked.filter((a) => a.tier === "S").length;
  const spent = picked.reduce((s, a) => s + (a.cost || 0), 0);
  const left = BUDGET_TOTAL - spent;
  const options = [];
  if (priciest.cost >= 30) options.push(`Tu as claqué ${priciest.cost}M sur ${priciest.name}.`);
  if (sCount >= 3) options.push(`${sCount} superstars dans un seul label. Culotté.`);
  if (left >= 8) options.push(`Il te reste ${left}M en poche. Malin.`);
  if (picked.some((a) => a.tier === "C")) options.push(`Tu as parié sur une pépite que peu connaissent.`);
  options.push(`7 artistes, 1 pari. C'est le tien.`);
  return options[0];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function JoinFlow({ artists, sourceId, crewCode, referrerId }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [screen, setScreen] = useState("draft"); // draft | lock | card | done
  const [selected, setSelected] = useState([]); // artist ids, in pick order
  const [floaters, setFloaters] = useState([]); // {id, text} floating budget deltas
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [howOpen, setHowOpen] = useState(false);

  // Signature (S4)
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pseudo, setPseudo] = useState("");
  const [avail, setAvail] = useState(null); // { name, taken } — last checked result
  const [signing, setSigning] = useState(false);
  const [signError, setSignError] = useState("");

  // Anonymous session — created lazily at the first pick.
  const userRef = useRef(null);
  const sessionPromiseRef = useRef(null);
  const floaterSeq = useRef(0);

  const byId = useMemo(() => Object.fromEntries(artists.map((a) => [a.id, a])), [artists]);
  const picked = useMemo(() => selected.map((id) => byId[id]).filter(Boolean), [selected, byId]);
  const spent = picked.reduce((s, a) => s + (a.cost || 0), 0);
  const remaining = BUDGET_TOTAL - spent;
  const count = selected.length;
  const hasDiversity = meetsDiversityRule(picked);
  const full = count >= ROSTER_SIZE;
  const minCost = useMemo(() => Math.min(...artists.map((a) => a.cost || 1)), [artists]);

  // Capture acquisition context + top-of-funnel events, once.
  useEffect(() => {
    captureContext({ sourceId, crewCode, referrerId });
    logEvent(supabase, "link_clicked", { source_id: sourceId, crew_code: crewCode });
    logEvent(supabase, "page_loaded", { load_ms: Math.round(performance.now?.() || 0) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Create the anonymous session the moment the first pick happens, so pick
  // events carry a user and the final signature is a fast write, not a signup.
  const ensureSession = useCallback(() => {
    if (userRef.current) return Promise.resolve(userRef.current);
    if (!sessionPromiseRef.current) {
      sessionPromiseRef.current = supabase.auth.signInAnonymously().then(({ data }) => {
        userRef.current = data?.user || null;
        return userRef.current;
      });
    }
    return sessionPromiseRef.current;
  }, [supabase]);

  // The two slots left must include an outsider — after 5 picks, if no Tier B/C
  // yet, the grid silently narrows to B/C under the heading "Ton outsider".
  const needsOutsider = count >= ROSTER_SIZE - 2 && !hasDiversity;

  const gridPool = useMemo(() => {
    let pool = artists;
    if (count === 0) {
      // Cold open — a short grid of the biggest, most recognizable names.
      pool = [...artists].sort((a, b) => b.cost - a.cost).slice(0, 12);
    } else if (needsOutsider) {
      pool = artists.filter((a) => a.tier === "B" || a.tier === "C");
    }
    const q = search.trim().toLowerCase();
    if (q) pool = pool.filter((a) => a.name.toLowerCase().includes(q));
    return [...pool].sort((a, b) => b.cost - a.cost); // price descending
  }, [artists, count, needsOutsider, search]);

  // Reserve enough budget for the remaining empty slots so you can never get
  // stuck: an artist is only tappable if picking it still leaves the rest fillable.
  const isAffordable = useCallback(
    (a) => {
      const slotsAfter = ROSTER_SIZE - count - 1;
      return (a.cost || 0) <= remaining - slotsAfter * minCost;
    },
    [count, remaining, minCost]
  );

  function addPick(a) {
    if (selected.includes(a.id) || full || !isAffordable(a)) return;
    ensureSession().then((u) =>
      logEvent(
        supabase,
        "pick_made",
        { slot_index: count, artist_id: a.id, remaining_budget: remaining - a.cost },
        u?.id
      )
    );
    if (navigator.vibrate) navigator.vibrate(10);
    const fid = `${a.id}-${(floaterSeq.current += 1)}`;
    setFloaters((f) => [...f, { id: fid, text: `-${a.cost}M` }]);
    setTimeout(() => setFloaters((f) => f.filter((x) => x.id !== fid)), 700);
    setSelected((prev) => [...prev, a.id]);
  }

  function removePick(id) {
    const a = byId[id];
    logEvent(
      supabase,
      "pick_removed",
      { slot_index: selected.indexOf(id), artist_id: id },
      userRef.current?.id
    );
    if (navigator.vibrate) navigator.vibrate(8);
    setSelected((prev) => prev.filter((x) => x !== id));
  }

  function autofill() {
    ensureSession();
    logEvent(supabase, "autofill_used", { picks_remaining: ROSTER_SIZE - count }, userRef.current?.id);
    setSelected((prev) => completeRoster(artists, prev));
  }

  function lockRoster() {
    logEvent(supabase, "draft_locked", { roster_ids: selected, budget_spent: spent }, userRef.current?.id);
    setScreen("lock");
    setTimeout(() => {
      setScreen("card");
      logEvent(supabase, "card_rendered", { stat_type: "auto" }, userRef.current?.id);
    }, 1800);
  }

  // Live pseudo availability (debounced). We only write state from the async
  // result — "checking"/empty are derived below, never set synchronously here.
  useEffect(() => {
    const name = pseudo.trim();
    if (name.length < 3) return;
    let active = true;
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .ilike("username", name)
        .limit(1);
      if (active) setAvail({ name, taken: !!(data && data.length) });
    }, 350);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [pseudo, supabase]);

  // Derived availability for the current input (no stored "checking" state).
  const pseudoName = pseudo.trim();
  const availStatus =
    pseudoName.length < 3
      ? null
      : avail && avail.name === pseudoName
      ? avail.taken
        ? "taken"
        : "free"
      : "checking";

  async function sign(e) {
    e.preventDefault();
    setSignError("");
    const name = pseudo.trim();
    if (name.length < 3 || availStatus === "taken") return;
    setSigning(true);
    logEvent(supabase, "pseudo_submitted", { attempts: 1 }, userRef.current?.id);

    const user = await ensureSession();
    if (!user) {
      setSigning(false);
      setSignError("Connexion impossible. Réessaie.");
      return;
    }

    const { error: pErr } = await supabase
      .from("profiles")
      .insert({ id: user.id, username: name, is_admin: isReservedAdminPseudo(name) });
    if (pErr) {
      setSigning(false);
      setSignError(pErr.code === "23505" ? "Ce blaze est déjà pris." : "Une erreur est survenue.");
      if (pErr.code === "23505") setAvail({ name, taken: true });
      return;
    }

    const rows = selected.map((artist_id) => ({ user_id: user.id, artist_id }));
    await supabase.from("roster_entries").insert(rows);

    logEvent(
      supabase,
      "account_created",
      { pseudo: name, xp_granted: 50, streak: 1, roster_ids: selected },
      user.id
    );

    setSigning(false);
    setSheetOpen(false);
    setScreen("done");
  }

  const isCrew = !!crewCode;

  // =========================================================================
  // S2 — Ceremony
  // =========================================================================
  if (screen === "lock") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[var(--bg)] px-8">
        <div className="ceremony-vinyl relative w-40 h-40 rounded-full flex items-center justify-center"
          style={{ background: "repeating-radial-gradient(circle at center, #0d0a12 0 3px, #17121e 3px 6px)" }}>
          <div className="absolute inset-[38%] rounded-full bg-[var(--gold)]" />
          <div className="relative z-10 grid grid-cols-3 gap-1 p-6 opacity-90">
            {picked.slice(0, 7).map((a) => (
              <div key={a.id} className="w-6 h-6 rounded-full overflow-hidden bg-[var(--surface-2)]">
                {a.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.image_url} alt="" className="w-full h-full object-cover" />
                ) : null}
              </div>
            ))}
          </div>
        </div>
        <div className="display text-2xl mt-8 fade-up" style={{ animationDelay: "1300ms" }}>
          Ton label est signé.
        </div>
      </div>
    );
  }

  // =========================================================================
  // S3 — Unsigned card  /  S4 — Signature sheet
  // =========================================================================
  if (screen === "card") {
    return (
      <div className="min-h-screen px-5 pt-6 pb-10 flex flex-col">
        {/* The card */}
        <div className="fade-up bg-gradient-to-b from-[var(--surface)] to-[var(--bg-alt)] border border-[var(--gold)]/40 rounded-3xl p-5 shadow-2xl">
          <div className="flex items-center justify-between mb-4">
            <div className="display text-xl">LABEL<span className="text-[var(--gold)]">.</span></div>
            <div className="mono text-[11px] text-[var(--text-faint)]">{spent}M engagés</div>
          </div>
          <div className="grid grid-cols-4 gap-2.5 mb-4">
            {picked.map((a) => (
              <div key={a.id} className="text-center">
                <div className="aspect-square rounded-full overflow-hidden bg-[var(--surface-2)] border border-[var(--border)] mb-1">
                  {a.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.image_url} alt={a.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-sm font-extrabold"
                      style={{ background: a.color, color: "#1a1310" }}>{a.initials}</div>
                  )}
                </div>
                <div className="text-[9px] leading-tight text-[var(--text-muted)] truncate">{a.name}</div>
              </div>
            ))}
          </div>
          {/* Empty dotted name plate — the card exists, it belongs to no one yet */}
          <div className="border-2 border-dashed border-[var(--border)] rounded-xl py-2.5 text-center text-[var(--text-faint)] text-sm">
            · · · · · ·
          </div>
          <div className="mt-3 text-center text-[13px] text-[var(--gold)] font-semibold">
            {divisiveStat(picked)}
          </div>
        </div>

        <div className="text-center mt-5 mb-1 text-[10px] tracking-[0.15em] text-[var(--text-faint)] font-bold">
          GRATUIT · PAS DE PARIS · PAS D&apos;EMAIL
        </div>
        <button onClick={() => { setHowOpen(true); logEvent(supabase, "howitworks_opened", {}, userRef.current?.id); }}
          className="mx-auto text-xs text-[var(--text-muted)] underline mb-6">
          Comment ça marche
        </button>

        <div className="flex-1" />

        <button onClick={() => setSheetOpen(true)}
          className="w-full bg-[var(--gold)] text-[#1a1310] font-extrabold uppercase tracking-wide text-sm rounded-xl py-4">
          Signe ta carte
        </button>

        {/* How-it-works overlay (never navigates) */}
        {howOpen && (
          <div className="overlay-fade fixed inset-0 z-40 bg-black/70 flex items-end" onClick={() => setHowOpen(false)}>
            <div className="sheet-up bg-[var(--surface)] w-full max-w-md mx-auto rounded-t-3xl p-6 pb-10" onClick={(e) => e.stopPropagation()}>
              <div className="display text-lg mb-4">Comment ça marche</div>
              <ul className="space-y-3 text-sm text-[var(--text-muted)]">
                <li>🎧 <b className="text-[var(--text)]">Tu signes 7 artistes</b> avec 100M de budget.</li>
                <li>📈 <b className="text-[var(--text)]">Leur score bouge</b> avec leurs vrais streams, sorties et actus.</li>
                <li>🏆 <b className="text-[var(--text)]">Tu grimpes</b> au classement quand ton label performe.</li>
                <li>🆓 Gratuit, sans paris et sans argent réel.</li>
              </ul>
              <button onClick={() => setHowOpen(false)} className="mt-6 w-full bg-[var(--surface-2)] rounded-xl py-3 text-sm font-bold">
                Compris
              </button>
            </div>
          </div>
        )}

        {/* S4 — signature bottom sheet */}
        {sheetOpen && (
          <div className="fixed inset-0 z-40 bg-black/60 flex items-end" onClick={() => !signing && setSheetOpen(false)}>
            <div className="sheet-up bg-[var(--surface)] w-full max-w-md mx-auto rounded-t-3xl p-6 pb-8" onClick={(e) => e.stopPropagation()}>
              <div className="display text-lg mb-1">Mets ton nom dessus.</div>
              <p className="text-xs text-[var(--text-faint)] mb-4">Pas d&apos;email, pas de mot de passe.</p>
              <form onSubmit={sign}>
                <input
                  autoFocus
                  type="text"
                  value={pseudo}
                  maxLength={16}
                  onChange={(e) => setPseudo(e.target.value)}
                  placeholder="Ton blaze"
                  className="w-full bg-[var(--bg-alt)] border border-[var(--border)] rounded-xl px-4 py-3.5 text-base focus:outline-none focus:border-[var(--gold)]"
                />
                <div className="h-5 mt-1.5 text-xs">
                  {availStatus === "checking" && <span className="text-[var(--text-faint)]">Vérification…</span>}
                  {availStatus === "free" && <span className="text-[var(--gold)]">✓ Disponible</span>}
                  {availStatus === "taken" && <span className="text-[var(--crimson)]">Déjà pris</span>}
                  {signError && <span className="text-[var(--crimson)]">{signError}</span>}
                </div>
                <button
                  type="submit"
                  disabled={signing || pseudo.trim().length < 3 || availStatus === "taken"}
                  className="mt-2 w-full bg-[var(--gold)] text-[#1a1310] font-extrabold uppercase tracking-wide text-sm rounded-xl py-3.5 disabled:opacity-40">
                  {signing ? "…" : "Signer"}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // S5 — Starting state
  // =========================================================================
  if (screen === "done") {
    return <StartingState pseudo={pseudo.trim()} isCrew={isCrew} onEnter={() => { router.push("/roster"); router.refresh(); }} />;
  }

  // =========================================================================
  // S1 — The plateau (states A/B/C)
  // =========================================================================
  const perSlot = count < ROSTER_SIZE ? Math.round(remaining / (ROSTER_SIZE - count)) : 0;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Context banner (sticky) */}
      <div className="sticky top-0 z-30 bg-[var(--bg)] px-4 pt-3 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isCrew && (
            <div className="w-7 h-7 rounded-full bg-[var(--violet)] flex items-center justify-center text-[11px] font-black text-white">
              {crewCode.slice(0, 2).toUpperCase()}
            </div>
          )}
          <span className="text-sm font-bold">
            {isCrew ? `Tu rejoins le crew de ${crewCode}` : "Compose ton label."}
          </span>
        </div>
        <button onClick={() => setSearchOpen((v) => !v)} aria-label="Chercher"
          className="w-8 h-8 rounded-full bg-[var(--surface)] flex items-center justify-center text-sm">🔎</button>
      </div>

      {/* Budget + progress (sticky) */}
      <div className="sticky top-[52px] z-20 bg-[var(--bg)] px-4 pb-2">
        <div className="relative">
          <div className="flex justify-between items-baseline mb-1">
            <span className="text-[11px] uppercase tracking-wide text-[var(--text-faint)] font-bold">Budget</span>
            <span className="mono text-sm font-bold">{count === 0 ? `${BUDGET_TOTAL}M à dépenser` : `${remaining}M`}</span>
          </div>
          <div className="h-2 bg-[var(--surface-2)] rounded-full overflow-hidden">
            <div className="h-full bg-[var(--gold)] transition-all duration-500" style={{ width: `${(spent / BUDGET_TOTAL) * 100}%` }} />
          </div>
          {/* floating deltas */}
          <div className="absolute right-0 -top-1 pointer-events-none">
            {floaters.map((f) => (
              <span key={f.id} className="float-delta absolute right-0 mono text-sm font-bold text-[var(--crimson)]">{f.text}</span>
            ))}
          </div>
        </div>
        <div className="mt-1.5 text-xs text-[var(--text-muted)]">
          {count === 0 && "7 places à remplir"}
          {count > 0 && !full && `${count} sur 7 · ${remaining}M restants · ~${perSlot}M par place`}
          {full && <span className="text-[var(--gold)] font-bold">Label complet — prêt à verrouiller.</span>}
        </div>
      </div>

      {/* Search (hidden by default) */}
      {searchOpen && (
        <div className="px-4 pb-2">
          <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Chercher un artiste…"
            className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-[var(--gold)]" />
        </div>
      )}

      {/* Autofill escape hatch (from 3rd pick) */}
      {count >= 3 && !full && (
        <div className="px-4 pb-1 text-center">
          <button onClick={autofill} className="text-sm text-[var(--gold)] font-semibold">Complète pour moi →</button>
          <div className="text-[10px] text-[var(--text-faint)]">Tu pourras tout changer.</div>
        </div>
      )}

      {/* Outsider heading (state C) */}
      {needsOutsider && (
        <div className="px-4 pt-2 pb-1 text-[13px] font-bold text-[var(--violet)]">Ton outsider</div>
      )}

      {/* Grid */}
      <div className="px-4 pt-2 grid grid-cols-3 gap-2.5 pb-40">
        {gridPool.map((a) => {
          const isSel = selected.includes(a.id);
          const afford = isAffordable(a);
          const dim = !isSel && (full || !afford);
          const line = contextLine(a);
          return (
            <button key={a.id} onClick={() => addPick(a)} disabled={dim || isSel}
              className={`text-left bg-[var(--surface)] border rounded-2xl p-2 transition ${isSel ? "border-[var(--gold)]" : "border-[var(--border)]"} ${dim ? "opacity-[0.35]" : ""}`}>
              <div className="relative aspect-square rounded-xl overflow-hidden bg-[var(--surface-2)] mb-1.5">
                {a.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.image_url} alt={a.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-lg font-extrabold" style={{ background: a.color, color: "#1a1310" }}>{a.initials}</div>
                )}
                {isSel && <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-[var(--gold)] text-[#1a1310] text-xs font-bold flex items-center justify-center">✓</div>}
              </div>
              <div className="text-[11px] font-bold leading-tight truncate">{a.name}</div>
              <div className="mono text-[11px] font-bold text-[var(--gold)]">{a.cost}M</div>
              <div className={`text-[9px] leading-tight truncate ${line.tone === "up" ? "text-[var(--gold)]" : line.tone === "down" ? "text-[var(--crimson)]" : "text-[var(--text-faint)]"}`}>{line.text}</div>
            </button>
          );
        })}
        {gridPool.length === 0 && <p className="col-span-3 text-center text-[var(--text-faint)] text-sm py-8">Aucun artiste trouvé.</p>}
      </div>

      {/* Roster band + CTA (sticky bottom, appears at 1st pick) */}
      {count > 0 && (
        <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-[var(--bg-alt)] border-t border-[var(--border)] px-3 pt-2.5 pb-4">
          <div className="grid grid-cols-7 gap-1.5 mb-2">
            {Array.from({ length: ROSTER_SIZE }).map((_, i) => {
              const a = picked[i];
              return a ? (
                <button key={a.id} onClick={() => removePick(a.id)} className="slot-pop relative aspect-square rounded-lg overflow-hidden bg-[var(--surface-2)]">
                  {a.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.image_url} alt={a.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[10px] font-extrabold" style={{ background: a.color, color: "#1a1310" }}>{a.initials}</div>
                  )}
                  <div className="absolute inset-0 bg-black/0 active:bg-black/40 flex items-center justify-center text-white text-xs opacity-0 active:opacity-100">✕</div>
                </button>
              ) : (
                <div key={`e${i}`} className="aspect-square rounded-lg border border-dashed border-[var(--border)]" />
              );
            })}
          </div>
          {full && (
            <button onClick={lockRoster} className="w-full bg-[var(--gold)] text-[#1a1310] font-extrabold uppercase tracking-wide text-sm rounded-xl py-3.5">
              Verrouiller mon label
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// S5 — Starting state (chips cascade + open loop countdown)
// ---------------------------------------------------------------------------
function StartingState({ pseudo, isCrew, onEnter }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Next 18:00 local (computed once, in a lazy initializer)
  const [target] = useState(() => {
    const d = new Date();
    d.setHours(18, 0, 0, 0);
    if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
    return d.getTime();
  });
  const left = Math.max(0, target - now);
  const h = String(Math.floor(left / 3.6e6)).padStart(2, "0");
  const m = String(Math.floor((left % 3.6e6) / 6e4)).padStart(2, "0");
  const s = String(Math.floor((left % 6e4) / 1000)).padStart(2, "0");

  const chips = [
    { t: "50 XP", d: 150 },
    { t: "Série : 1 jour 🔥", d: 300 },
    { t: isCrew ? "287e sur 340" : "Classement révélé à 18h00", d: 450 },
  ];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-8 text-center">
      <div className="display text-3xl mb-1 fade-up">{pseudo}</div>
      <div className="text-[var(--text-faint)] text-sm mb-8 fade-up" style={{ animationDelay: "120ms" }}>ton label est à toi.</div>

      <div className="flex flex-wrap gap-2 justify-center mb-10">
        {chips.map((c) => (
          <span key={c.t} className="chip-in bg-[var(--surface)] border border-[var(--border)] rounded-full px-4 py-2 text-sm font-bold" style={{ animationDelay: `${c.d}ms` }}>
            {c.t}
          </span>
        ))}
      </div>

      <div className="fade-up" style={{ animationDelay: "600ms" }}>
        <div className="text-sm text-[var(--text-muted)] mb-1">Premier score ce soir à 18h00</div>
        <div className="mono text-3xl font-bold text-[var(--gold)]">{h}:{m}:{s}</div>
      </div>

      <button onClick={onEnter} className="mt-12 w-full max-w-xs bg-[var(--gold)] text-[#1a1310] font-extrabold uppercase tracking-wide text-sm rounded-xl py-3.5 fade-up" style={{ animationDelay: "750ms" }}>
        Entrer dans mon label →
      </button>
    </div>
  );
}
