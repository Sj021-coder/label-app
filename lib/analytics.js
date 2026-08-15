// Lightweight first-party product analytics (client-side helpers).
//
// A stable per-browser "visitor id" is the key to conversion funnels: it lets
// us stitch together the PRE-signup steps (landing viewed, draft started —
// no user_id exists yet) with the moment an account is created. Both carry the
// same visitor_id in `events.metadata`, so a funnel query can follow one person
// step by step and see exactly where people drop.
//
// `variant` is stamped on every event so the SAME funnel works once we split
// onboarding into A/B variants — this base flow is simply variant "base".

const VISITOR_KEY = "label_visitor_id";
export const ONBOARDING_VARIANT = "base";

// Returns a stable id for this browser, creating one on first call.
// Best-effort: private mode / blocked storage just yields null (no crash).
export function getVisitorId() {
  if (typeof window === "undefined") return null;
  try {
    let id = window.localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id =
        window.crypto?.randomUUID?.() ||
        `v_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      window.localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

// Fire-and-forget event logging. Analytics must NEVER block or break the
// user's flow, so every failure path is swallowed silently.
export function track(supabase, eventType, metadata = {}, userId = null) {
  try {
    const row = {
      event_type: eventType,
      user_id: userId,
      metadata: {
        visitor_id: getVisitorId(),
        variant: ONBOARDING_VARIANT,
        ...metadata,
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
