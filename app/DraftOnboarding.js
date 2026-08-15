"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { track } from "@/lib/analytics";
import { isReservedAdminPseudo } from "@/lib/adminPseudos";
import {
  BUDGET_TOTAL,
  ROSTER_SIZE,
  TIERS,
  meetsDiversityRule,
  totalCost,
} from "@/lib/gameRules";

const TIER_ORDER = ["S", "A", "B", "C"];

// Build a valid roster (<=100M, <=7, at least one Tier B/C), optionally
// starting from an existing selection. Powers "Complète pour moi" & "Équipe surprise".
function buildRoster(pool, startIds = []) {
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

export default function DraftOnboarding({ artists }) {
  const [step, setStep] = useState(1); // 1 = pick artists, 2 = pseudo, 3 = email (optional)
  const [selected, setSelected] = useState([]);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [emailSaved, setEmailSaved] = useState(false);
  const [userId, setUserId] = useState(null); // set once the account exists
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState(null);
  const router = useRouter();
  const supabase = createClient();

  // Funnel: landing viewed (top of the onboarding funnel).
  useEffect(() => {
    track(supabase, "onboarding_landing_viewed");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedArtists = useMemo(
    () => artists.filter((a) => selected.includes(a.id)),
    [artists, selected]
  );
  const spent = totalCost(selectedArtists);
  const remaining = BUDGET_TOTAL - spent;
  const hasDiversity = meetsDiversityRule(selectedArtists);
  const canContinue =
    selected.length > 0 && selected.length <= ROSTER_SIZE && hasDiversity;

  function toggle(artist) {
    setSelected((prev) => {
      const isSelected = prev.includes(artist.id);
      if (isSelected) return prev.filter((x) => x !== artist.id);
      if (prev.length >= ROSTER_SIZE) return prev;
      if (spent + artist.cost > BUDGET_TOTAL) return prev;
      if (prev.length === 0) track(supabase, "draft_started"); // funnel: first pick
      return [...prev, artist.id];
    });
  }

  async function handleValidate(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { data: signInData, error: signInError } =
      await supabase.auth.signInAnonymously();

    if (signInError) {
      setLoading(false);
      setError(
        "Impossible de créer un compte. (Vérifie que 'Anonymous Sign-ins' est activé dans Supabase.)"
      );
      return;
    }

    const user = signInData.user;

    const { error: profileError } = await supabase
      .from("profiles")
      .insert({
        id: user.id,
        username: username.trim(),
        is_admin: isReservedAdminPseudo(username),
      });

    if (profileError) {
      setLoading(false);
      setError(
        profileError.code === "23505" ? "Ce pseudo est déjà pris." : profileError.message
      );
      return;
    }

    const rows = selected.map((artistId) => ({
      user_id: user.id,
      artist_id: artistId,
    }));
    const { error: rosterError } = await supabase
      .from("roster_entries")
      .insert(rows);

    setLoading(false);
    if (rosterError) {
      setError(rosterError.message);
      return;
    }

    // Funnel — fire-and-forget, tagged with visitor_id so pre-signup steps
    // stitch to this account. account_created is the primary conversion event.
    track(supabase, "account_created", {}, user.id);
    track(supabase, "roster_drafted", { size: selected.length, spent }, user.id);

    // Account is DONE here. The next screen (email) is a pure OPTIONAL upsell —
    // it never gates account creation, per the locked auth model.
    setUserId(user.id);
    setStep(3);
  }

  // Step 3: optionally link an email to the anonymous account for recovery /
  // cross-device. Supabase upgrades the SAME user_id in place — no data lost.
  async function handleAddEmail(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error: updateError } = await supabase.auth.updateUser({
      email: email.trim(),
    });

    setLoading(false);
    if (updateError) {
      setError(
        updateError.message?.includes("registered")
          ? "Cet email est déjà utilisé."
          : "Impossible d'enregistrer cet email pour l'instant."
      );
      return;
    }

    track(supabase, "email_added", {}, userId);
    setEmailSaved(true); // show the "check your inbox" confirmation, then continue
  }

  function finishOnboarding(skipped) {
    if (skipped) track(supabase, "email_skipped", {}, userId);
    router.push("/roster");
    router.refresh();
  }

  function renderCard(a) {
    const isSelected = selected.includes(a.id);
    const full = selected.length >= ROSTER_SIZE && !isSelected;
    const tooExpensive = !isSelected && a.cost > remaining;
    const disabled = full || tooExpensive;
    return (
      <button
        key={a.id}
        onClick={() => toggle(a)}
        disabled={disabled}
        className={`text-left bg-[var(--surface)] border rounded-2xl p-2.5 transition ${
          isSelected
            ? "border-[var(--gold)]"
            : disabled
            ? "border-[var(--border)] opacity-40"
            : "border-[var(--border)]"
        }`}
      >
        <div className="mb-2 relative aspect-square rounded-xl overflow-hidden bg-[var(--surface-2)]">
          {a.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={a.image_url} alt={a.name} className="w-full h-full object-cover" />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center text-xl font-extrabold"
              style={{ background: a.color, color: "#1a1310" }}
            >
              {a.initials}
            </div>
          )}
          {isSelected && (
            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[var(--gold)] text-[#1a1310] text-xs font-bold flex items-center justify-center">
              ✓
            </div>
          )}
        </div>
        <div className="text-xs font-bold mb-0.5 leading-tight">{a.name}</div>
        {tooExpensive ? (
          <div className="mono text-[11px] font-bold text-[var(--crimson)]">
            Trop cher · reste {remaining}M
          </div>
        ) : (
          <div className="mono text-[11px] font-bold text-[var(--gold)]">{a.cost}M</div>
        )}
      </button>
    );
  }

  if (step === 1) {
    const q = search.trim().toLowerCase();
    const isVisible = (a) =>
      (!tierFilter || a.tier === tierFilter) && (!q || a.name.toLowerCase().includes(q));
    const groups = TIER_ORDER.map((tier) => ({
      tier,
      list: artists.filter((a) => a.tier === tier && isVisible(a)),
    })).filter((g) => g.list.length > 0);

    return (
      <div className="px-4 pb-28">
        <div className="text-center pt-6 pb-4">
          <div className="display text-3xl mb-1">
            LABEL<span className="text-[var(--gold)]">.</span>
          </div>
          <p className="text-[var(--text-muted)] text-sm max-w-xs mx-auto">
            Signe 7 artistes avec 100M. Choisis les têtes que tu connais — le reste suit.
          </p>
        </div>

        {/* Budget bar (sticky) */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl px-4 py-3 mb-3 sticky top-2 z-20">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[11px] uppercase tracking-wide text-[var(--text-faint)] font-bold">
              Budget
            </span>
            <span className="mono text-sm font-bold">
              {remaining}M <span className="text-[var(--text-faint)] font-normal">/ {BUDGET_TOTAL}M</span>
            </span>
          </div>
          <div className="h-2 bg-[var(--surface-2)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--gold)] transition-all"
              style={{ width: `${Math.min(100, (spent / BUDGET_TOTAL) * 100)}%` }}
            />
          </div>
          <div className="flex justify-between items-center mt-2">
            <span className="text-xs text-[var(--text-faint)]">
              {selected.length}/{ROSTER_SIZE} artistes
            </span>
            {!hasDiversity && selected.length > 0 && (
              <span className="text-xs text-[var(--crimson)]">Ajoute 1 artiste ⭐⭐ ou ⭐</span>
            )}
            {hasDiversity && <span className="text-xs text-[var(--gold)]">✓ Règle diversité OK</span>}
          </div>
        </div>

        {/* Shortcuts: never a blank page */}
        <div className="flex gap-2 mb-1.5">
          <button
            onClick={() => setSelected(buildRoster(artists, []))}
            className="flex-1 bg-[var(--surface-2)] border border-[var(--border)] rounded-xl py-2.5 text-xs font-bold"
          >
            ✨ Équipe surprise
          </button>
          <button
            onClick={() => setSelected((prev) => buildRoster(artists, prev))}
            disabled={selected.length >= ROSTER_SIZE}
            className="flex-1 bg-[var(--surface-2)] border border-[var(--border)] rounded-xl py-2.5 text-xs font-bold disabled:opacity-40"
          >
            🪄 Complète pour moi
          </button>
        </div>
        <p className="text-center text-[10px] text-[var(--text-faint)] mb-3">
          Un raccourci, pas un choix définitif — tu pourras tout changer après.
        </p>

        {/* Search (always visible) */}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔎 Chercher un artiste…"
          className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3.5 py-2.5 text-sm mb-2 focus:outline-none focus:border-[var(--gold)]"
        />

        {/* Tier filter pills (one tap) */}
        <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
          <button
            onClick={() => setTierFilter(null)}
            className={`whitespace-nowrap text-[11px] font-bold px-3 py-1.5 rounded-full border ${
              tierFilter === null
                ? "bg-[var(--gold)] text-[#1a1310] border-[var(--gold)]"
                : "bg-[var(--surface)] text-[var(--text-muted)] border-[var(--border)]"
            }`}
          >
            Tous
          </button>
          {TIER_ORDER.map((t) => (
            <button
              key={t}
              onClick={() => setTierFilter(tierFilter === t ? null : t)}
              className={`whitespace-nowrap text-[11px] font-bold px-3 py-1.5 rounded-full border ${
                tierFilter === t
                  ? "bg-[var(--gold)] text-[#1a1310] border-[var(--gold)]"
                  : "bg-[var(--surface)] text-[var(--text-muted)] border-[var(--border)]"
              }`}
            >
              {TIERS[t].stars}
            </button>
          ))}
        </div>

        {/* Grouped by tier, Superstars first */}
        {groups.length === 0 && (
          <p className="text-center text-[var(--text-faint)] text-sm py-6">Aucun artiste trouvé.</p>
        )}
        {groups.map((g) => (
          <div key={g.tier} className="mb-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[13px] font-bold">{TIERS[g.tier].stars}</span>
              <span className="text-[11px] uppercase tracking-wide text-[var(--text-faint)] font-bold">
                {TIERS[g.tier].label}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2.5">{g.list.map(renderCard)}</div>
          </div>
        ))}

        {/* Fixed continue bar */}
        <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto px-4 pb-5 pt-3 bg-gradient-to-t from-[var(--bg)] via-[var(--bg)] to-transparent">
          <button
            onClick={() => {
              track(supabase, "onboarding_pseudo_viewed", { size: selected.length });
              setStep(2);
            }}
            disabled={!canContinue}
            className="w-full bg-[var(--gold)] text-[#1a1310] font-extrabold uppercase tracking-wide text-sm rounded-xl py-3.5 disabled:opacity-40"
          >
            Continuer ({selected.length} signé{selected.length > 1 ? "s" : ""})
          </button>
          <p className="text-center text-[10px] text-[var(--text-faint)] mt-1.5">
            ✏️ Rien n&apos;est figé — tu peux transférer tes artistes plus tard.
          </p>
        </div>
      </div>
    );
  }

  // Step 2: pseudo → creates the account (the conversion moment)
  if (step === 2) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
        <div className="display text-3xl mb-2 leading-tight">
          Presque
          <br />
          <span className="text-[var(--gold)]">Prêt.</span>
        </div>
        <p className="text-[var(--text-muted)] text-sm mb-2 max-w-xs">
          Choisis un pseudo pour sauvegarder ton label de {selected.length} artiste
          {selected.length > 1 ? "s" : ""} ({spent}M dépensés).
        </p>
        <p className="text-[var(--text-faint)] text-xs mb-7">Pas d&apos;email, pas de mot de passe.</p>
        <form onSubmit={handleValidate} className="w-full max-w-xs space-y-3">
          <input
            type="text"
            required
            maxLength={24}
            placeholder="Ton pseudo"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full text-center bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[var(--gold)]"
          />
          {error && <p className="text-[var(--crimson)] text-xs">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[var(--gold)] text-[#1a1310] font-extrabold uppercase tracking-wide text-sm rounded-xl py-3 disabled:opacity-60"
          >
            {loading ? "..." : "Valider mon label"}
          </button>
          <button
            type="button"
            onClick={() => setStep(1)}
            className="text-xs text-[var(--text-faint)] underline"
          >
            ← Modifier ma sélection
          </button>
        </form>
      </div>
    );
  }

  // Step 3: OPTIONAL email — the account already exists, this only adds
  // recovery + cross-device. Skipping is a first-class action, never a dead end.
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
      <div className="text-4xl mb-3">🔒</div>
      <div className="display text-2xl mb-2 leading-tight">
        Protège
        <br />
        <span className="text-[var(--gold)]">ton label.</span>
      </div>

      {emailSaved ? (
        <>
          <p className="text-[var(--text-muted)] text-sm mb-2 max-w-xs">
            On t&apos;a envoyé un lien de confirmation. Clique dessus quand tu veux — ton
            label est déjà sauvegardé.
          </p>
          <button
            onClick={() => finishOnboarding(false)}
            className="w-full max-w-xs bg-[var(--gold)] text-[#1a1310] font-extrabold uppercase tracking-wide text-sm rounded-xl py-3 mt-5"
          >
            C&apos;est parti →
          </button>
        </>
      ) : (
        <>
          <p className="text-[var(--text-muted)] text-sm mb-1.5 max-w-xs">
            Ajoute un email pour retrouver ton label si tu changes de téléphone ou vides
            ton navigateur.
          </p>
          <p className="text-[var(--text-faint)] text-xs mb-7 max-w-xs">
            Aucun spam. Juste pour récupérer ton compte — {username || "ton pseudo"} reste
            le même.
          </p>
          <form onSubmit={handleAddEmail} className="w-full max-w-xs space-y-3">
            <input
              type="email"
              required
              placeholder="ton@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full text-center bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[var(--gold)]"
            />
            {error && <p className="text-[var(--crimson)] text-xs">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[var(--gold)] text-[#1a1310] font-extrabold uppercase tracking-wide text-sm rounded-xl py-3 disabled:opacity-60"
            >
              {loading ? "..." : "Sauvegarder mon label"}
            </button>
            <button
              type="button"
              onClick={() => finishOnboarding(true)}
              className="w-full text-xs text-[var(--text-faint)] underline py-1"
            >
              Plus tard — accéder à mon label
            </button>
          </form>
        </>
      )}
    </div>
  );
}
