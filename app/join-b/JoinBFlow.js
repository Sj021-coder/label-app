"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import VinylAvatar from "@/components/VinylAvatar";
import { captureContext, logEvent } from "@/lib/onboarding/tracking";
import { isReservedAdminPseudo } from "@/lib/adminPseudos";
import {
  BUDGET_TOTAL,
  ROSTER_SIZE,
  TIERS,
  meetsDiversityRule,
  totalCost,
} from "@/lib/gameRules";

const VARIANT = "phase1-b";
const TIER_ORDER = ["S", "A", "B", "C"];

// Fill remaining slots with a valid roster (<=100M, <=7, >=1 Tier B/C).
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

export default function JoinBFlow({ artists, hook, sourceId, crewCode, referrerId }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [page, setPage] = useState(1); // 1 landing · 2 draft · 3 recap · 4 name · 5 confirm
  const [selected, setSelected] = useState([]);
  const [username, setUsername] = useState("");
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState(null);
  const [hintSeen, setHintSeen] = useState(false); // "Tape pour ajouter" — one time
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedName, setSavedName] = useState("");

  const log = (type, extra = {}, uid = null) =>
    logEvent(supabase, type, { variant: VARIANT, ...extra }, uid);

  const byId = useMemo(() => Object.fromEntries(artists.map((a) => [a.id, a])), [artists]);
  const picked = useMemo(() => selected.map((id) => byId[id]).filter(Boolean), [selected, byId]);
  const spent = totalCost(picked);
  const remaining = BUDGET_TOTAL - spent;
  const hasDiversity = meetsDiversityRule(picked);
  const canContinue = selected.length > 0 && selected.length <= ROSTER_SIZE && hasDiversity;

  useEffect(() => {
    captureContext({ sourceId, crewCode, referrerId });
    log("link_clicked", { source_id: sourceId, hook: hook || null });
    log("page_loaded", { load_ms: Math.round(performance.now?.() || 0) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle(a) {
    if (!hintSeen) setHintSeen(true);
    setSelected((prev) => {
      const has = prev.includes(a.id);
      if (has) return prev.filter((x) => x !== a.id);
      if (prev.length >= ROSTER_SIZE) return prev;
      if (spent + a.cost > BUDGET_TOTAL) return prev;
      log("pick_made", { artist_id: a.id, slot_index: prev.length, remaining_budget: remaining - a.cost });
      return [...prev, a.id];
    });
  }

  async function saveLabel(e) {
    e.preventDefault();
    setError("");
    const name = username.trim();
    if (!name) return;
    setSaving(true);
    log("pseudo_submitted", { attempts: 1 });

    const { data: signInData, error: signInError } = await supabase.auth.signInAnonymously();
    if (signInError || !signInData?.user) {
      setSaving(false);
      setError("Impossible de créer le compte. Réessaie.");
      return;
    }
    const user = signInData.user;

    const { error: pErr } = await supabase
      .from("profiles")
      .insert({ id: user.id, username: name, is_admin: isReservedAdminPseudo(name) });
    if (pErr) {
      setSaving(false);
      setError(pErr.code === "23505" ? "Ce nom de label est déjà pris." : "Une erreur est survenue.");
      return;
    }

    const rows = selected.map((artist_id) => ({ user_id: user.id, artist_id }));
    await supabase.from("roster_entries").insert(rows);

    log("account_created", { pseudo: name, start_value: spent, roster_ids: selected }, user.id);

    setSavedName(name);
    setSaving(false);
    setPage(5);
    setTimeout(() => {
      router.push("/roster");
      router.refresh();
    }, 1600);
  }

  // =========================================================================
  // PAGE 1 — Landing
  // =========================================================================
  if (page === 1) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-8 text-center">
        <div className="spin-slow mb-9">
          <div className="w-40 h-40 rounded-full flex items-center justify-center"
            style={{ background: "repeating-radial-gradient(circle at center, #0d0a12 0 3px, #17121e 3px 6px)" }}>
            <div className="w-14 h-14 rounded-full bg-[var(--gold)] flex items-center justify-center">
              <span className="display text-lg text-[#160f22]">L</span>
            </div>
          </div>
        </div>
        <h1 className="display text-3xl leading-[1.05] mb-3">
          {hook || "Compose ton label de rap. Regarde-le scorer en vrai."}
        </h1>
        <p className="text-[var(--text-muted)] text-sm mb-10 max-w-xs">
          100M à dépenser. 7 artistes. Zéro inscription pour commencer.
        </p>
        <button
          onClick={() => { log("landing_cta_clicked"); setPage(2); }}
          className="w-full max-w-xs bg-[var(--gold)] text-[#1a1310] font-extrabold uppercase tracking-wide text-sm rounded-xl py-4"
        >
          Voir mes artistes
        </button>
      </div>
    );
  }

  // =========================================================================
  // PAGE 2 — Draft
  // =========================================================================
  if (page === 2) {
    const q = search.trim().toLowerCase();
    const isVisible = (a) =>
      (!tierFilter || a.tier === tierFilter) && (!q || a.name.toLowerCase().includes(q));
    const groups = TIER_ORDER.map((tier) => ({
      tier,
      list: artists.filter((a) => a.tier === tier && isVisible(a)),
    })).filter((g) => g.list.length > 0);

    return (
      <div className="px-4 pb-28">
        {/* Budget bar (positive framing — "disponibles", never "dépensé") */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl px-4 py-3 mb-3 sticky top-2 z-20">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[11px] uppercase tracking-wide text-[var(--text-faint)] font-bold">Budget</span>
            <span className="mono text-sm font-bold">{remaining}M disponibles</span>
          </div>
          <div className="h-2 bg-[var(--surface-2)] rounded-full overflow-hidden">
            <div className="h-full bg-[var(--gold)] transition-all" style={{ width: `${(spent / BUDGET_TOTAL) * 100}%` }} />
          </div>
          <div className="flex justify-between items-center mt-2">
            <span className="text-xs text-[var(--text-faint)]">{selected.length}/{ROSTER_SIZE} artistes</span>
            {!hasDiversity && selected.length > 0 && <span className="text-xs text-[var(--crimson)]">Ajoute 1 artiste ⭐⭐ ou ⭐</span>}
            {hasDiversity && <span className="text-xs text-[var(--gold)]">✓ Prêt</span>}
          </div>
        </div>

        {/* One-time first-gesture hint — vanishes after the first tap */}
        {!hintSeen && (
          <p className="text-center text-xs text-[var(--text-muted)] mb-2">👆 Tape pour ajouter un artiste</p>
        )}

        {/* Search */}
        <input
          type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="🔎 Chercher un artiste…"
          className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3.5 py-2.5 text-sm mb-2 focus:outline-none focus:border-[var(--gold)]"
        />

        {/* Tier pills */}
        <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
          <button onClick={() => setTierFilter(null)}
            className={`whitespace-nowrap text-[11px] font-bold px-3 py-1.5 rounded-full border ${tierFilter === null ? "bg-[var(--gold)] text-[#1a1310] border-[var(--gold)]" : "bg-[var(--surface)] text-[var(--text-muted)] border-[var(--border)]"}`}>
            Tous
          </button>
          {TIER_ORDER.map((t) => (
            <button key={t} onClick={() => setTierFilter(tierFilter === t ? null : t)}
              className={`whitespace-nowrap text-[11px] font-bold px-3 py-1.5 rounded-full border ${tierFilter === t ? "bg-[var(--gold)] text-[#1a1310] border-[var(--gold)]" : "bg-[var(--surface)] text-[var(--text-muted)] border-[var(--border)]"}`}>
              {TIERS[t].stars}
            </button>
          ))}
        </div>

        {groups.length === 0 && <p className="text-center text-[var(--text-faint)] text-sm py-6">Aucun artiste trouvé.</p>}
        {groups.map((g) => (
          <div key={g.tier} className="mb-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[13px] font-bold">{TIERS[g.tier].stars}</span>
              <span className="text-[11px] uppercase tracking-wide text-[var(--text-faint)] font-bold">{TIERS[g.tier].label}</span>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {g.list.map((a) => {
                const isSel = selected.includes(a.id);
                const full = selected.length >= ROSTER_SIZE && !isSel;
                const tooExpensive = !isSel && a.cost > remaining;
                const disabled = full || tooExpensive;
                return (
                  <button key={a.id} onClick={() => toggle(a)} disabled={disabled}
                    className={`text-left bg-[var(--surface)] border rounded-2xl p-2.5 transition ${isSel ? "border-[var(--gold)]" : disabled ? "border-[var(--border)] opacity-40" : "border-[var(--border)]"}`}>
                    <div className="mb-2 relative aspect-square rounded-xl overflow-hidden bg-[var(--surface-2)]">
                      {a.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={a.image_url} alt={a.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xl font-extrabold" style={{ background: a.color, color: "#1a1310" }}>{a.initials}</div>
                      )}
                      {isSel && <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[var(--gold)] text-[#1a1310] text-xs font-bold flex items-center justify-center">✓</div>}
                    </div>
                    <div className="text-xs font-bold mb-0.5 leading-tight">{a.name}</div>
                    {tooExpensive ? (
                      <div className="mono text-[11px] font-bold text-[var(--crimson)]">Trop cher · reste {remaining}M</div>
                    ) : (
                      <div className="mono text-[11px] font-bold text-[var(--gold)]">{a.cost}M</div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* Continue bar */}
        <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto px-4 pb-5 pt-3 bg-gradient-to-t from-[var(--bg)] via-[var(--bg)] to-transparent">
          <button
            onClick={() => { log("draft_locked", { roster_ids: selected, budget_spent: spent }); setPage(3); }}
            disabled={!canContinue}
            className="w-full bg-[var(--gold)] text-[#1a1310] font-extrabold uppercase tracking-wide text-sm rounded-xl py-3.5 disabled:opacity-40"
          >
            Continuer ({selected.length}/{ROSTER_SIZE})
          </button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // PAGE 3 — Recap / pre-signup (Affirm → Activate)
  // =========================================================================
  if (page === 3) {
    // Log the recap view once when we arrive.
    return (
      <RecapPage
        picked={picked}
        spent={spent}
        onView={() => log("recap_viewed", { roster_ids: selected, start_value: spent })}
        onSave={() => { log("save_clicked"); setPage(4); }}
      />
    );
  }

  // =========================================================================
  // PAGE 4 — Name the label (the only ask)
  // =========================================================================
  if (page === 4) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <div className="display text-2xl mb-8 leading-tight">Choisis ton<br />nom de label.</div>
        <form onSubmit={saveLabel} className="w-full max-w-xs">
          <input
            autoFocus type="text" maxLength={24} value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Nom de ton label"
            className="w-full text-center bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3.5 text-base focus:outline-none focus:border-[var(--gold)]"
          />
          <div className="h-5 mt-1.5 text-xs">
            {error && <span className="text-[var(--crimson)]">{error}</span>}
          </div>
          <button
            type="submit" disabled={saving || !username.trim()}
            className="w-full bg-[var(--gold)] text-[#1a1310] font-extrabold uppercase tracking-wide text-sm rounded-xl py-3.5 disabled:opacity-40"
          >
            {saving ? "…" : "Valider mon label"}
          </button>
          <p className="text-[11px] text-[var(--text-faint)] mt-3">Gratuit. Toujours.</p>
        </form>
      </div>
    );
  }

  // =========================================================================
  // PAGE 5 — Confirmation (peak-end: identity, not "success")
  // =========================================================================
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-8 text-center">
      <div className="display text-4xl leading-tight fade-up">
        {savedName}
        <br />
        <span className="text-[var(--gold)]">existe.</span>
      </div>
    </div>
  );
}

// Recap page split out so we can fire "recap_viewed" exactly once on mount.
function RecapPage({ picked, spent, onView, onSave }) {
  useEffect(() => {
    onView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="min-h-screen flex flex-col items-center px-6 pt-10 pb-10 text-center">
      <div className="display text-3xl mb-2">Ton label est prêt.</div>
      <p className="text-[var(--text-muted)] text-sm mb-7">Encore 10 secondes pour sauvegarder.</p>

      {/* Compact proof of what they'd lose (7 vinyls) */}
      <div className="grid grid-cols-4 gap-3 mb-7 justify-items-center">
        {picked.map((a) => (
          <div key={a.id} className="flex flex-col items-center">
            <VinylAvatar initials={a.initials} color={a.color} size={52} />
            <span className="text-[9px] text-[var(--text-muted)] mt-1 truncate max-w-[52px]">{a.name}</span>
          </div>
        ))}
      </div>

      <div className="bg-[var(--surface)] border border-[var(--gold)]/40 rounded-2xl px-6 py-3 mb-auto">
        <div className="text-[11px] uppercase tracking-wide text-[var(--text-faint)] font-bold">Valeur de départ</div>
        <div className="mono text-2xl font-bold text-[var(--gold)]">{spent}M</div>
      </div>

      <button
        onClick={onSave}
        className="w-full max-w-xs bg-[var(--gold)] text-[#1a1310] font-extrabold uppercase tracking-wide text-sm rounded-xl py-4 mt-6"
      >
        Sauvegarder mon label
      </button>
      <p className="text-[11px] text-[var(--text-faint)] mt-3">Gratuit. Pas d&apos;email. Change d&apos;avis quand tu veux.</p>
    </div>
  );
}
