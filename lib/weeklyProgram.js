// The weekly programme — the shared calendar backbone of the whole retention
// loop. Two moments are COMMUNAL (everyone experiences the same window at
// once, like a show airing at a set time): team management (captain + trade),
// and predictions + news. The third (Bilan) is INDIVIDUAL — each person gets
// theirs on their own weekly clock, staggered from when they joined, so
// everyone isn't hitting it the same day.
//
// Pure functions, no DB reads — usable identically on the server (route
// guards) and the client (the countdown banner). All times UTC, aligned to
// the sync engine's 08:00/20:00 run times so windows open/close exactly when
// a real sync has just happened, not in some dead moment between them.

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

// Most recent Monday, pinned to 08:00 UTC (the morning sync).
function mondayAt8UTC(date) {
  const d = new Date(date);
  const day = d.getUTCDay(); // 0 = Sunday .. 6 = Saturday
  const mondayOffset = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - mondayOffset);
  d.setUTCHours(8, 0, 0, 0);
  if (d.getTime() > date.getTime()) d.setUTCDate(d.getUTCDate() - 7); // stay in the past
  return d;
}

// Returns which communal phase we're in right now, plus the next transition.
export function getWeeklyProgram(now = new Date()) {
  const monday8 = mondayAt8UTC(now);
  const tuesday20 = new Date(monday8.getTime() + 1 * DAY + 12 * HOUR); // Mon 08:00 -> Tue 20:00
  const thursday8 = new Date(monday8.getTime() + 3 * DAY);
  const friday8 = new Date(thursday8.getTime() + 1 * DAY);
  const nextMonday8 = new Date(monday8.getTime() + 7 * DAY);

  const t = now.getTime();

  if (t >= monday8.getTime() && t < tuesday20.getTime()) {
    return {
      phase: "team",
      label: "Capitaine & transfert",
      emoji: "🧢",
      closesAt: tuesday20,
      nextPhase: "predictions",
      nextAt: thursday8,
    };
  }
  if (t >= thursday8.getTime() && t < friday8.getTime()) {
    return {
      phase: "predictions",
      label: "Pronostics & actu",
      emoji: "🔮",
      closesAt: friday8,
      nextPhase: "team",
      nextAt: nextMonday8,
    };
  }
  // Quiet stretch — no communal window open, banner just points forward.
  const upcomingIsThursday = t < thursday8.getTime();
  return {
    phase: "quiet",
    label: null,
    emoji: null,
    closesAt: null,
    nextPhase: upcomingIsThursday ? "predictions" : "team",
    nextAt: upcomingIsThursday ? thursday8 : nextMonday8,
  };
}

const PHASE_ROUTE = { team: "/roster", predictions: "/pickem", quiet: null };
export function nextPhaseRoute(nextPhase) {
  return PHASE_ROUTE[nextPhase] || "/roster";
}

// --- Individual Bilan (personal weekly recap) ---
// No new DB column needed: derived purely from profiles.created_at. Each
// person's "week" is 7 real days since they joined, recurring — so everyone
// lands on a different day, spreading the comeback instead of clustering it.
export function getBilanWindow(createdAt, now = new Date()) {
  const created = new Date(createdAt);
  const elapsedDays = (now.getTime() - created.getTime()) / DAY;
  const ready = elapsedDays >= 7; // no bilan before your first full week exists

  if (!ready) {
    const periodEnd = new Date(created.getTime() + 7 * DAY);
    return { ready: false, periodStart: created, periodEnd, nextAt: periodEnd };
  }

  // The MOST RECENTLY COMPLETED 7-day block — not the one still in progress.
  // Stays fixed on that block for the whole following week, then rolls over.
  const completedWeeks = Math.floor(elapsedDays / 7);
  const periodEnd = new Date(created.getTime() + completedWeeks * 7 * DAY);
  const periodStart = new Date(periodEnd.getTime() - 7 * DAY);
  const nextAt = new Date(periodEnd.getTime() + 7 * DAY); // when this bilan gets replaced
  return { ready: true, periodStart, periodEnd, nextAt };
}

export function formatCountdown(targetDate, now = new Date()) {
  const diff = targetDate.getTime() - now.getTime();
  if (diff <= 0) return "maintenant";
  const days = Math.floor(diff / DAY);
  const hours = Math.floor((diff % DAY) / HOUR);
  const mins = Math.floor((diff % HOUR) / 60000);
  if (days > 0) return `${days}j ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}min`;
  return `${mins}min`;
}
