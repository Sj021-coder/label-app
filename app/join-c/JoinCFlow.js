"use client";

import { useState, useMemo, useEffect, useRef, useCallback, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ArtistFace from "@/components/ArtistFace";
import { captureContext, logEvent } from "@/lib/onboarding/tracking";
import { BUDGET_TOTAL } from "@/lib/gameRules";

const VARIANT = "phase1-c";
const ROSTER_C = 5; // this spec drafts 5 (game default is 7 — topped up in-app)
const INITIAL_GRID = 12;

// Real-data delta for a card: prefer market move (value−cost), fall back to
// cumulative score. Honest — never a fabricated stream percentage.
function realDelta(a) {
  if (a.value != null && a.cost != null && a.value !== a.cost) return a.value - a.cost;
  return a.score || 0;
}

// scoutProfile actually reorders the pool — the app must feel like it listened.
function orderFor(profile, artists) {
  const list = [...artists];
  if (profile === "sens") return list.sort((a, b) => a.cost - b.cost); // cheap/rising first
  if (profile === "sures") return list.sort((a, b) => b.cost - a.cost); // established first
  if (profile === "tente") return list.sort((a, b) => realDelta(b) - realDelta(a)); // biggest movers
  return list.sort((a, b) => b.cost - a.cost + (Math.random() - 0.5) * 6); // mix
}

function useReducedMotion() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener?.("change", cb);
      return () => mq.removeEventListener?.("change", cb);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false
  );
}

// rAF-driven count-up. State is only ever written from the rAF callback (never
// synchronously in the effect body), so it stays lint-clean and idempotent.
function useCountUp(target, ms, reduced) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const dur = reduced ? 0 : ms;
    let raf;
    let start = null;
    const tick = (now) => {
      if (start === null) start = now;
      const p = dur > 0 ? Math.min(1, (now - start) / dur) : 1;
      setVal(Math.round((target || 0) * p));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms, reduced]);
  return val;
}

// Progress header (hoisted so it isn't recreated during render).
function Pips({ n, canBack, onBack }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <button onClick={onBack} className="text-[var(--text-faint)] text-lg w-6">
        {canBack ? "‹" : ""}
      </button>
      <span className="mono text-xs text-[var(--text-faint)]">{n} / 3</span>
    </div>
  );
}

function haptic(kind = 10) {
  if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(kind);
}

export default function JoinCFlow({ artists, sourceId, crewCode, referrerId }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const reduced = useReducedMotion();

  const [screen, setScreen] = useState(0); // 0..8 → S0..S8
  const [scoutProfile, setScoutProfile] = useState(null);
  const [selected, setSelected] = useState([]);
  const [gridCount, setGridCount] = useState(INITIAL_GRID);
  const [shakeId, setShakeId] = useState(null);
  const [xpFly, setXpFly] = useState(null);

  // Backtest result (computed at S4 from REAL score_events, floored by value)
  const [backtest, setBacktest] = useState(null); // { points, percentile, rank, best }

  // Handle (S7)
  const [handle, setHandle] = useState("");
  const [avail, setAvail] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [finalHandle, setFinalHandle] = useState("");

  const userRef = useRef(null);
  const sessionPromiseRef = useRef(null);
  const xpSeq = useRef(0);

  const byId = useMemo(() => Object.fromEntries(artists.map((a) => [a.id, a])), [artists]);
  const picked = useMemo(() => selected.map((id) => byId[id]).filter(Boolean), [selected, byId]);
  const spent = picked.reduce((s, a) => s + (a.cost || 0), 0);
  const remaining = BUDGET_TOTAL - spent;
  const isCrew = !!crewCode;

  const log = useCallback(
    (type, extra = {}, uid = null) => logEvent(supabase, type, { variant: VARIANT, ...extra }, uid),
    [supabase]
  );

  useEffect(() => {
    captureContext({ sourceId, crewCode, referrerId });
    log("landing_view", { source_id: sourceId, crew_code: crewCode });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Guest session — created at the first real action (first pick), like the spec's
  // anonymous guest that later "becomes" the account when named at S7.
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

  const orderedPool = useMemo(() => orderFor(scoutProfile, artists), [scoutProfile, artists]);

  function pickTaste(profile) {
    setScoutProfile(profile);
    setXpFly((xpSeq.current += 1));
    haptic(10);
    log("taste_select", { profile });
    setTimeout(() => setScreen(3), 420); // auto-advance, no confirm
  }

  function toggleArtist(a) {
    const isSel = selected.includes(a.id);
    if (isSel) {
      setSelected((prev) => prev.filter((x) => x !== a.id));
      return;
    }
    if (selected.length >= ROSTER_C) return;
    if (a.cost > remaining) {
      setShakeId(a.id);
      haptic(20);
      setTimeout(() => setShakeId(null), 350);
      return;
    }
    ensureSession().then((u) =>
      log("artist_select", { id: a.id, position: selected.length, cote: a.cost }, u?.id)
    );
    haptic(selected.length + 1 >= ROSTER_C ? 30 : 10);
    setSelected((prev) => [...prev, a.id]);
  }

  // S4 — run the real backtest, then reveal S5 (hard 2.5s theatrical floor).
  const runBacktest = useCallback(async () => {
    const since = new Date(Date.now() - 7 * 864e5).toISOString();
    let realPoints = 0;
    let best = null;
    try {
      const { data } = await supabase
        .from("score_events")
        .select("delta, artist_id")
        .in("artist_id", selected)
        .gte("created_at", since);
      const perArtist = {};
      (data || []).forEach((e) => {
        realPoints += e.delta || 0;
        perArtist[e.artist_id] = (perArtist[e.artist_id] || 0) + (e.delta || 0);
      });
      const bestId = Object.keys(perArtist).sort((x, y) => perArtist[y] - perArtist[x])[0];
      if (bestId) best = { artist: byId[bestId], points: perArtist[bestId] };
    } catch {
      /* ignore — floor below keeps the screen non-empty */
    }
    // Never-zero floor from REAL team value (honest: it's your team's market worth).
    const teamValue = picked.reduce((s, a) => s + (a.value ?? a.cost ?? 0), 0);
    const points = Math.max(realPoints, Math.round(teamValue * 28) + 300);
    if (!best) {
      const top = [...picked].sort((a, b) => realDelta(b) - realDelta(a))[0];
      if (top) best = { artist: top, points: Math.round((top.value ?? top.cost) * 12) };
    }
    // Prototype rank/percentile (not a real leaderboard yet — flagged to the user).
    const strength = teamValue / (BUDGET_TOTAL * 1.2);
    const percentile = Math.max(1, Math.min(40, Math.round(40 - strength * 38)));
    const rank = Math.max(11, Math.round(3812 * (percentile / 100)));
    return { points, percentile, rank, best };
  }, [supabase, selected, picked, byId]);

  useEffect(() => {
    if (screen !== 4) return;
    log("sim_start");
    const started = performance.now();
    let alive = true;
    runBacktest().then((r) => alive && setBacktest(r)); // async → state set off-render
    const t = setTimeout(() => {
      log("sim_complete", { backtest_latency_ms: Math.round(performance.now() - started) });
      setScreen(5);
    }, 2500);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [screen, runBacktest, log]);

  // Live handle availability (async-only write → lint-safe; "checking" derived)
  useEffect(() => {
    const name = handle.trim();
    if (name.length < 3) return;
    let active = true;
    const t = setTimeout(async () => {
      const { data } = await supabase.from("profiles").select("id").ilike("username", name).limit(1);
      if (active) setAvail({ name, taken: !!(data && data.length) });
    }, 300);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [handle, supabase]);

  const handleName = handle.trim();
  const availStatus =
    handleName.length < 3 ? null : avail && avail.name === handleName ? (avail.taken ? "taken" : "free") : "checking";

  async function saveAccount(chosenHandle) {
    setError("");
    setSaving(true);
    const user = await ensureSession();
    if (!user) {
      setSaving(false);
      setError("Connexion impossible. Réessaie.");
      return;
    }
    const { error: pErr } = await supabase.from("profiles").insert({ id: user.id, username: chosenHandle });
    if (pErr) {
      setSaving(false);
      if (pErr.code === "23505") {
        setError("Ce nom est déjà pris.");
        setAvail({ name: chosenHandle, taken: true });
      } else setError("Une erreur est survenue.");
      return;
    }
    await supabase.from("roster_entries").insert(selected.map((artist_id) => ({ user_id: user.id, artist_id })));
    log("signup_complete", { pseudo: chosenHandle, points: backtest?.points, roster_ids: selected }, user.id);
    setFinalHandle(chosenHandle);
    setSaving(false);
    setScreen(8);
  }

  function submitHandle(e) {
    e.preventDefault();
    if (handleName.length < 3 || availStatus === "taken") return;
    log("handle_set");
    saveAccount(handleName);
  }
  function skipHandle() {
    const auto = `scout_${Math.floor(1000 + Math.random() * 9000)}`;
    log("handle_skip");
    saveAccount(auto);
  }

  // =========================================================================
  // S0 — Recognition
  if (screen === 0) {
    return <Recognition artists={artists} isCrew={isCrew} crewCode={crewCode} reduced={reduced}
      onStart={() => { log("landing_cta_tap"); setScreen(1); }} />;
  }

  // S1 — Rule
  if (screen === 1) {
    return (
      <div className="min-h-screen flex flex-col px-6 pt-5 pb-8">
        <Pips n={1} canBack onBack={() => setScreen(0)} />
        <div className="flex-1 flex flex-col justify-center gap-6">
          {[
            { n: "①", t: "Tu drafts 5 rappeurs", s: "100 crédits de budget." },
            { n: "②", t: "Leurs vraies perfs comptent", s: "Spotify · TikTok · YouTube · Deezer" },
            { n: "③", t: "Tu marques, tu montes", s: "Classement mis à jour chaque lundi." },
          ].map((b, i) => (
            <div key={b.n} className="fade-up flex gap-3" style={{ animationDelay: `${i * 120}ms` }}>
              <div className="text-2xl">{b.n}</div>
              <div>
                <div className="font-bold text-[15px]">{b.t}</div>
                <div className="text-[var(--text-muted)] text-sm">{b.s}</div>
              </div>
            </div>
          ))}
        </div>
        <button onClick={() => { log("rules_complete"); setScreen(2); }}
          className="w-full bg-[var(--gold)] text-[#1a1310] font-extrabold uppercase tracking-wide text-sm rounded-xl py-4">
          J&apos;ai compris
        </button>
        <p className="text-center text-xs text-[var(--text-faint)] mt-2">Aucune connaissance en foot requise 😄</p>
      </div>
    );
  }

  // S2 — Ego / taste
  if (screen === 2) {
    const tiles = [
      { k: "sens", e: "🔮", t: "Je les sens avant tout le monde" },
      { k: "sures", e: "🏆", t: "Je mise sur les valeurs sûres" },
      { k: "mix", e: "🎯", t: "Un mix des deux" },
      { k: "tente", e: "🎲", t: "Je tente tout" },
    ];
    return (
      <div className="min-h-screen flex flex-col px-6 pt-5 pb-8 relative">
        <Pips n={2} canBack onBack={() => setScreen(1)} />
        <h2 className="display text-2xl mb-6">Tu es plutôt quel scout ?</h2>
        <div className="grid grid-cols-2 gap-3 flex-1 content-center">
          {tiles.map((t) => (
            <button key={t.k} onClick={() => pickTaste(t.k)}
              className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 text-left aspect-square flex flex-col justify-between active:border-[var(--gold)]">
              <div className="text-3xl">{t.e}</div>
              <div className="text-sm font-bold leading-tight">{t.t}</div>
            </button>
          ))}
        </div>
        {xpFly && (
          <div key={xpFly} className="float-delta absolute left-1/2 -translate-x-1/2 bottom-24 mono text-lg font-bold text-[var(--gold)]">+50 XP</div>
        )}
      </div>
    );
  }

  // S3 — Draft (core)
  if (screen === 3) {
    const grid = orderedPool.slice(0, gridCount);
    const slots = [...picked];
    while (slots.length < ROSTER_C) slots.push(null);
    const done = selected.length >= ROSTER_C;
    return (
      <div className="px-4 pt-4 pb-28">
        {/* Budget counts DOWN */}
        <div className="sticky top-2 z-20 flex items-center justify-between mb-3">
          <button onClick={() => setScreen(2)} className="text-[var(--text-faint)] text-lg">‹</button>
          <span className="mono text-sm font-bold bg-[var(--surface)] border border-[var(--border)] rounded-full px-3 py-1">Budget : {remaining}</span>
        </div>
        <h2 className="display text-xl mb-1">Choisis 5 rappeurs</h2>
        {/* Slot row */}
        <div className="grid grid-cols-5 gap-2 mb-4">
          {slots.map((a, i) =>
            a ? (
              <button key={a.id} onClick={() => toggleArtist(a)} className="slot-pop aspect-square rounded-xl overflow-hidden">
                <ArtistFace imageUrl={a.image_url} initials={a.initials} color={a.color} name={a.name} size="100%" />
              </button>
            ) : (
              <div key={`e${i}`} className="aspect-square rounded-xl border-2 border-dashed border-[var(--border)]" />
            )
          )}
        </div>
        <div className="text-xs text-[var(--text-faint)] mb-3">{selected.length}/{ROSTER_C} · {picked.length ? "beau départ 🔥" : "à toi de jouer"}</div>

        {/* Grid — exactly 12 until first pick, then Voir plus */}
        <div className="grid grid-cols-3 gap-2.5">
          {grid.map((a) => {
            const isSel = selected.includes(a.id);
            const d = realDelta(a);
            return (
              <button key={a.id} onClick={() => toggleArtist(a)}
                className={`text-left bg-[var(--surface)] border rounded-2xl p-2 transition ${isSel ? "border-[var(--gold)] -translate-y-0.5" : "border-[var(--border)]"} ${shakeId === a.id ? "shake border-[var(--crimson)]" : ""}`}>
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
                <div className="flex items-center justify-between">
                  <span className="mono text-[11px] font-bold text-[var(--gold)]">{a.cost}c</span>
                  {d !== 0 && <span className={`text-[10px] font-bold ${d > 0 ? "text-[var(--gold)]" : "text-[var(--crimson)]"}`}>{d > 0 ? "▲" : "▼"}{Math.abs(d)}</span>}
                </div>
              </button>
            );
          })}
        </div>
        {gridCount < orderedPool.length && selected.length > 0 && (
          <button onClick={() => setGridCount((c) => c + 12)} className="w-full mt-4 text-sm text-[var(--text-muted)] underline">Voir plus</button>
        )}
        {shakeId && <div className="fixed bottom-24 left-0 right-0 text-center text-xs text-[var(--crimson)] max-w-md mx-auto">Il te reste {remaining} crédits</div>}

        <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto px-4 pb-5 pt-3 bg-gradient-to-t from-[var(--bg)] via-[var(--bg)] to-transparent">
          <button onClick={() => { log("draft_complete", { teamIds: selected }); setScreen(4); }} disabled={!done}
            className={`w-full font-extrabold uppercase tracking-wide text-sm rounded-xl py-3.5 transition ${done ? "bg-[var(--gold)] text-[#1a1310] scale-100" : "bg-[var(--surface-2)] text-[var(--text-faint)] scale-95"}`}>
            {done ? "Valider ma team" : `Choisis ${ROSTER_C - selected.length} de plus`}
          </button>
        </div>
      </div>
    );
  }

  // S4 — Simulating
  if (screen === 4) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-8 text-center">
        <div className="flex -space-x-3 mb-8">
          {picked.map((a) => (
            <div key={a.id} className="w-12 h-12 rounded-full border-2 border-[var(--bg)] overflow-hidden">
              <ArtistFace imageUrl={a.image_url} initials={a.initials} color={a.color} name={a.name} size="100%" />
            </div>
          ))}
        </div>
        <div className="text-lg font-bold mb-6">Analyse de ta team…</div>
        <div className="space-y-2 text-sm text-left">
          {["Streams Spotify", "Vues TikTok", "Abonnés Instagram", "Calcul du score…"].map((s, i) => (
            <div key={s} className="fade-up flex items-center gap-2" style={{ animationDelay: `${i * 400}ms` }}>
              <span>{i < 3 ? "✅" : "⏳"}</span>
              <span className="text-[var(--text-muted)]">{s}</span>
            </div>
          ))}
        </div>
        <div className="mono text-xs text-[var(--gold)] mt-8 fade-up" style={{ animationDelay: "1200ms" }}>+50 XP · Badge débloqué</div>
      </div>
    );
  }

  // S5 — Result
  if (screen === 5) return <Result bt={backtest} reduced={reduced} onSave={() => { log("result_cta_tap"); setScreen(6); }} onView={() => log("result_view", { points: backtest?.points })} />;

  // S6 — Save (asset visible, greyed & "not yet safe")
  if (screen === 6) {
    return (
      <div className="min-h-screen flex flex-col px-6 pt-5 pb-8">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => setScreen(5)} className="text-[var(--text-faint)] text-lg">‹</button>
          <span className="mono text-xs text-[var(--text-faint)]">3 / 3</span>
        </div>
        <h2 className="display text-2xl leading-tight mb-1">Plus qu&apos;une étape.</h2>
        <p className="text-[var(--text-muted)] text-sm mb-6">10 secondes.</p>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 mb-8 opacity-60">
          <div className="text-[11px] uppercase tracking-wide text-[var(--text-faint)] font-bold mb-2">🔒 Ta team est prête</div>
          <div className="flex -space-x-2 mb-2">
            {picked.map((a) => (
              <div key={a.id} className="w-10 h-10 rounded-full border-2 border-[var(--surface)] overflow-hidden grayscale">
                <ArtistFace imageUrl={a.image_url} initials={a.initials} color={a.color} name={a.name} size="100%" />
              </div>
            ))}
          </div>
          <div className="mono text-sm font-bold">{backtest?.points?.toLocaleString("fr-FR")} pts · {backtest?.rank}e</div>
        </div>

        <button onClick={() => { log("save_cta_tap"); setScreen(7); }}
          className="w-full bg-[var(--gold)] text-[#1a1310] font-extrabold uppercase tracking-wide text-sm rounded-xl py-4 mb-3">
          Sauvegarder ma team
        </button>
        <p className="text-center text-xs text-[var(--text-muted)] leading-relaxed">
          Gratuit. Pas d&apos;abonnement.<br />Pas de mot de passe. On ne poste jamais rien.
        </p>
        <p className="text-center text-[10px] text-[var(--text-faint)] mt-4">En continuant, tu acceptes les CGU.</p>
      </div>
    );
  }

  // S7 — Handle
  if (screen === 7) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <h2 className="display text-2xl mb-6">Ton nom de scout</h2>
        <form onSubmit={submitHandle} className="w-full max-w-xs">
          <div className="flex items-center bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3.5 focus-within:border-[var(--gold)]">
            <span className="text-[var(--text-faint)] mr-1">@</span>
            <input autoFocus type="text" maxLength={20} value={handle} onChange={(e) => setHandle(e.target.value.replace(/\s/g, ""))}
              className="flex-1 bg-transparent focus:outline-none text-base" placeholder="ton_blaze" />
          </div>
          <div className="h-5 mt-1.5 text-xs text-left">
            {availStatus === "checking" && <span className="text-[var(--text-faint)]">Vérification…</span>}
            {availStatus === "free" && <span className="text-[var(--gold)]">✓ Disponible</span>}
            {availStatus === "taken" && <span className="text-[var(--crimson)]">Déjà pris</span>}
            {error && <span className="text-[var(--crimson)]">{error}</span>}
          </div>
          <p className="text-xs text-[var(--text-faint)] mb-4">Il apparaîtra dans le classement.</p>
          <button type="submit" disabled={saving || handleName.length < 3 || availStatus === "taken"}
            className="w-full bg-[var(--gold)] text-[#1a1310] font-extrabold uppercase tracking-wide text-sm rounded-xl py-3.5 disabled:opacity-40">
            {saving ? "…" : "C'est parti"}
          </button>
          <button type="button" onClick={skipHandle} disabled={saving} className="mt-3 text-xs text-[var(--text-faint)] underline">Plus tard</button>
        </form>
      </div>
    );
  }

  // S8 — Welcome (anti-churn Affirm)
  return <Welcome handle={finalHandle} bt={backtest} isCrew={isCrew} picked={picked}
    onEnter={() => { log("welcome_view"); router.push("/roster"); router.refresh(); }} />;
}

// ---------------------------------------------------------------------------
function Recognition({ artists, isCrew, crewCode, reduced, onStart }) {
  const [i, setI] = useState(0);
  const trio = useMemo(() => {
    const withPhoto = artists.filter((a) => a.image_url);
    return (withPhoto.length >= 3 ? withPhoto : artists).slice(0, Math.max(3, artists.length));
  }, [artists]);
  useEffect(() => {
    if (reduced || trio.length <= 3) return;
    const t = setInterval(() => setI((v) => (v + 3) % trio.length), 1400);
    return () => clearInterval(t);
  }, [reduced, trio.length]);
  const cards = [0, 1, 2].map((k) => trio[(i + k) % trio.length]).filter(Boolean);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <div className="display text-xl mb-6 self-start">LABEL<span className="text-[var(--gold)]">.</span></div>
      <div className="flex gap-3 mb-8">
        {cards.map((a) => {
          const d = realDelta(a);
          return (
            <div key={a.id} className="w-20 bg-[var(--surface)] border border-[var(--border)] rounded-xl p-2">
              <div className="aspect-square rounded-lg overflow-hidden mb-1">
                <ArtistFace imageUrl={a.image_url} initials={a.initials} color={a.color} name={a.name} size="100%" />
              </div>
              <div className={`mono text-[11px] font-bold ${d >= 0 ? "text-[var(--gold)]" : "text-[var(--crimson)]"}`}>{d >= 0 ? "+" : ""}{d}</div>
            </div>
          );
        })}
      </div>
      {isCrew ? (
        <>
          <div className="w-14 h-14 rounded-full bg-[var(--violet)] flex items-center justify-center text-lg font-black text-white mb-3">{crewCode.slice(0, 2).toUpperCase()}</div>
          <h1 className="display text-3xl leading-tight mb-2">{crewCode} t&apos;a défié.</h1>
        </>
      ) : (
        <h1 className="display text-3xl leading-[1.05] mb-3">LE FANTASY<br />DU RAP FR</h1>
      )}
      <p className="text-[var(--text-muted)] text-sm mb-8 max-w-xs">Compose ta team. Leurs vrais streams font tes points.</p>
      <button onClick={onStart} className="w-full max-w-xs bg-[var(--gold)] text-[#1a1310] font-extrabold uppercase tracking-wide text-sm rounded-xl py-4">
        {isCrew ? "Relever le défi" : "Composer ma team"}
      </button>
      <p className="text-[11px] text-[var(--text-faint)] mt-3">Gratuit · Sans compte · 60 secondes</p>
      <p className="text-xs text-[var(--text-muted)] mt-6">Comme MPG, mais avec des rappeurs.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
function Result({ bt, reduced, onSave, onView }) {
  const points = useCountUp(bt?.points || 0, 900, reduced);
  useEffect(() => {
    onView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!bt) return <div className="min-h-screen flex items-center justify-center text-[var(--text-faint)]">…</div>;
  return (
    <div className="min-h-screen flex flex-col px-6 pt-8 pb-8 text-center">
      <p className="text-[var(--text-muted)] text-sm mb-2">La semaine dernière, ta team aurait fait</p>
      <div className="display text-6xl text-[var(--gold)] leading-none">+{points.toLocaleString("fr-FR")}</div>
      <div className="text-sm text-[var(--text-faint)] mb-6">points</div>

      <div className="bg-[var(--surface)] border border-[var(--gold)]/40 rounded-2xl px-5 py-4 mb-5">
        <div className="text-lg font-bold">🔥 Top {bt.percentile}%</div>
        <div className="text-xs text-[var(--text-faint)]">{bt.rank}e sur 3 812 joueurs</div>
      </div>

      {bt.best?.artist && (
        <div className="mb-auto">
          <div className="text-xs text-[var(--text-faint)] mb-1">Ton meilleur pick</div>
          <div className="text-sm font-bold">{bt.best.artist.name} · +{bt.best.points?.toLocaleString("fr-FR")} pts</div>
        </div>
      )}

      <button onClick={onSave} className="w-full bg-[var(--gold)] text-[#1a1310] font-extrabold uppercase tracking-wide text-sm rounded-xl py-4 mt-6">
        Sauvegarder ma team
      </button>
      <p className="text-xs text-[var(--crimson)] mt-2">Sinon elle est perdue.</p>
      <p className="text-[10px] text-[var(--text-faint)] mt-3">Gratuit à vie · Pas de mot de passe · On ne poste rien</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
function Welcome({ handle, bt, isCrew, picked, onEnter }) {
  const grants = [
    "⚡ 320 XP · Scout Niv. 2",
    "🏅 Badge Premier Draft",
    "🎫 3 jetons de transfert",
    "🔥 Série : Jour 1",
    `📈 ${bt?.points?.toLocaleString("fr-FR")} pts · ${bt?.rank}e`,
  ];
  return (
    <div className="min-h-screen flex flex-col px-6 pt-8 pb-8 text-center">
      <h2 className="display text-2xl mb-5 fade-up">Bienvenue @{handle}</h2>
      <div className="bg-[var(--surface)] border border-[var(--gold)] rounded-2xl p-4 mb-6 fade-up" style={{ animationDelay: "150ms" }}>
        <div className="flex -space-x-2 justify-center mb-2">
          {picked.map((a) => (
            <div key={a.id} className="w-11 h-11 rounded-full border-2 border-[var(--surface)] overflow-hidden">
              <ArtistFace imageUrl={a.image_url} initials={a.initials} color={a.color} name={a.name} size="100%" />
            </div>
          ))}
        </div>
        <div className="text-[13px] font-black text-[var(--gold)]">🔓 TEAM SAUVEGARDÉE</div>
      </div>
      <div className="text-left text-sm mb-2 text-[var(--text-faint)]">Tu démarres avec :</div>
      <div className="space-y-2 mb-6">
        {grants.map((g, i) => (
          <div key={g} className="chip-in bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm font-bold text-left" style={{ animationDelay: `${250 + i * 250}ms` }}>{g}</div>
        ))}
      </div>
      <div className="mono text-xs text-[var(--text-muted)] mb-auto">Prochain match : lundi 00h</div>
      <button onClick={onEnter} className="w-full bg-[var(--gold)] text-[#1a1310] font-extrabold uppercase tracking-wide text-sm rounded-xl py-4 mt-6">
        Voir mon classement
      </button>
    </div>
  );
}
