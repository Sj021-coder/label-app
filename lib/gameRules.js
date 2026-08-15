// Single source of truth for the game rules — Pillars 1, 2, 3, 4
export const BUDGET_TOTAL = 100; // Label Points (millions)
export const ROSTER_SIZE = 7;

export const TIERS = {
  S: { label: "Superstar", stars: "⭐⭐⭐⭐" },
  A: { label: "Established", stars: "⭐⭐⭐" },
  B: { label: "Rising", stars: "⭐⭐" },
  C: { label: "Emerging", stars: "⭐" },
};

// Diversity rule: roster must include at least one Tier B or C artist
export function meetsDiversityRule(rosterArtists) {
  return rosterArtists.some((a) => a.tier === "B" || a.tier === "C");
}

export function totalCost(rosterArtists) {
  return rosterArtists.reduce((sum, a) => sum + (a.cost || 0), 0);
}

export function remainingBudget(rosterArtists) {
  return BUDGET_TOTAL - totalCost(rosterArtists);
}

// --- Pillar 2: weighted scoring formula ---
export const SCORE_WEIGHTS = {
  momentum: 0.4,
  performance: 0.3,
  activity: 0.2,
  culture: 0.1,
};

export function computeWeightedScore({ momentum_score, performance_score, activity_score, culture_score }) {
  const weighted =
    (momentum_score || 0) * SCORE_WEIGHTS.momentum +
    (performance_score || 0) * SCORE_WEIGHTS.performance +
    (activity_score || 0) * SCORE_WEIGHTS.activity +
    (culture_score || 0) * SCORE_WEIGHTS.culture;
  return Math.round(weighted);
}

// --- Pillar 3: transfers & captain ---
export const TRANSFER_BANK_CAP = 2;
export const TRANSFER_FREE_PER_WEEK = 1;
export const TRANSFER_PENALTY = 4;
export const TRANSFER_REFRESH_DAYS = 7;

// --- Pillar 4: Pick'em ---
// Betting-style stakes: every pick'em risks a fixed stake. The admin sets a
// per-question "coefficient" (cote) when creating it. Win = +stake*(coefficient-1)
// (you keep your stake AND profit). Lose = -stake. Never voting = no change,
// not a penalty — the loss is losing the CHANCE, not points you never risked.
export const PICKEM_STAKE = 10;
export const PICKEM_DEFAULT_COEFFICIENT = 2.0;
