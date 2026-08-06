// Mirrors scoring-rule-sheet-v0.1.md — single source of truth for the app.
// Each event now carries a `category` used by the weighted scoring formula:
// Momentum 40% / Performance 30% / Activity 20% / Culture 10%
export const SCORING_EVENTS = [
  { key: "stream_tick", label: "Daily stream tick", delta: 3, category: "momentum" },
  { key: "view_spike", label: "YouTube view spike (+50%)", delta: 8, category: "momentum" },
  { key: "inactivity", label: "14 days no activity", delta: -3, category: "momentum" },

  { key: "top50", label: "Enters national Top 50", delta: 15, category: "performance" },
  { key: "top10", label: "Enters national Top 10", delta: 30, category: "performance" },
  { key: "chart_up", label: "Chart position +1 rank", delta: 2, category: "performance" },
  { key: "chart_down", label: "Chart position -1 rank", delta: -2, category: "performance" },
  { key: "chart_off", label: "Falls off chart", delta: -10, category: "performance" },

  { key: "feature", label: "Feature / collab drop", delta: 10, category: "activity" },
  { key: "festival", label: "Festival / show announced", delta: 5, category: "activity" },
  { key: "tour", label: "Tour announced", delta: 10, category: "activity" },
  { key: "label_deal", label: "Label signing / major deal", delta: 15, category: "activity" },
  { key: "hiatus", label: "Hiatus announced", delta: -20, category: "activity" },

  { key: "nomination", label: "Award nomination", delta: 20, category: "culture" },
  { key: "award_win", label: "Award win", delta: 40, category: "culture" },
  { key: "viral", label: "Verified viral moment", delta: 12, category: "culture" },
  { key: "press_pos", label: "Positive press", delta: 5, category: "culture" },
  { key: "press_neg", label: "Negative press / controversy", delta: -15, category: "culture" },
  { key: "beef", label: "Beef / diss track drop", delta: 8, category: "culture" },

  { key: "custom", label: "Custom (set delta + category manually)", delta: 0, category: null },
];

export const CATEGORIES = [
  { key: "momentum", label: "Momentum (Spotify/TikTok/YouTube growth)" },
  { key: "performance", label: "Performance (streams/charts)" },
  { key: "activity", label: "Activity (releases/features/collabs)" },
  { key: "culture", label: "Culture (viral/awards/controversy)" },
];
