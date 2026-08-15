// ⚠️ DEV-ONLY convenience — lets you become admin just by using this pseudo
// during onboarding, so testing doesn't depend on hunting down a specific
// browser session (anonymous accounts have no password to "log back into").
//
// This must be removed (or replaced with a real invite-only admin flow)
// before any public launch — anyone who ever types this pseudo gets admin.
// It's also enforced client-side only; RLS doesn't yet restrict who can set
// is_admin on their own profile row (same gap as the existing "Admin
// permission lock" backlog item in CLAUDE.md §9 — real DB-level hardening,
// not just this list, is the actual pre-launch fix).
const ADMIN_PSEUDOS = ["Sj021"];

export function isReservedAdminPseudo(name) {
  return ADMIN_PSEUDOS.includes((name || "").trim());
}
