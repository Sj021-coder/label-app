// Onboarding Phase 1 — event logging.
//
// Every event carries the same acquisition context so the funnel is
// interpretable: which link (source_id), which crew (crew_code), and — crucial
// per the spec — who referred this person (referrer_id). Without referrer_id
// you can't separate seeded users from viral ones and every rate becomes noise.
//
// Two ids identify the human:
//   session_id  — this browser tab/session (sessionStorage, one funnel run)
//   visitor_id  — this browser across sessions (localStorage, dedup returns)
// Both let us stitch the PRE-account steps (picks, lock) to the account created
// at signature, even though user_id only exists from the first pick onward.

import { getVisitorId } from "@/lib/analytics";

const SESSION_KEY = "label_session_id";
const CTX_KEY = "label_onboarding_ctx";
export const ONBOARDING_VARIANT = "phase1-base";

function uuid() {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    /* secure-context only — fall through */
  }
  return `s_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function getSessionId() {
  if (typeof window === "undefined") return null;
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = uuid();
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

// Capture acquisition params ONCE (first screen) and persist them for the whole
// run, so later events keep the context even after redirects strip the query.
export function captureContext({ sourceId, crewCode, referrerId } = {}) {
  if (typeof window === "undefined") return {};
  try {
    const existing = JSON.parse(sessionStorage.getItem(CTX_KEY) || "null");
    if (existing) return existing;
    const ctx = {
      source_id: sourceId || null,
      crew_code: crewCode || null,
      referrer_id: referrerId || null,
    };
    sessionStorage.setItem(CTX_KEY, JSON.stringify(ctx));
    return ctx;
  } catch {
    return { source_id: sourceId || null, crew_code: crewCode || null, referrer_id: referrerId || null };
  }
}

function getContext() {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(sessionStorage.getItem(CTX_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

// Fire-and-forget. Analytics must NEVER block or break the funnel, so every
// failure path is swallowed. `extra` holds event-specific fields (slot_index,
// remaining_budget, roster_ids, …). `userId` is set once the session exists.
export function logEvent(supabase, eventType, extra = {}, userId = null) {
  try {
    const row = {
      event_type: eventType,
      user_id: userId,
      metadata: {
        variant: ONBOARDING_VARIANT,
        session_id: getSessionId(),
        visitor_id: getVisitorId(),
        ...getContext(),
        ...extra,
      },
    };
    supabase
      .from("events")
      .insert(row)
      .then(
        () => {},
        () => {}
      );
  } catch {
    /* never surface analytics errors to the user */
  }
}
