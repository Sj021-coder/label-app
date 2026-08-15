// ⚠️ DEV-ONLY convenience — lets you become admin just by using this pseudo
// during onboarding, so testing doesn't depend on hunting down a specific
// browser session (anonymous accounts have no password to log back into).
//
// This must be removed (or replaced with a real invite-only admin flow)
// before any public launch — anyone who ever types this pseudo gets admin.
// It's also enforced client-side only; RLS doesn't yet restrict who can set
// is_admin on their own profile row (same gap as the existing "Admin
// permission lock" backlog item in CLAUDE.md §9 — real DB-level hardening,
// not just this list, is the actual pre-launch fix).
const ADMIN_PSEUDO_BASE = "Sj021";

// Prefix match, not exact — every fresh anonymous test account needs a
// UNIQUE username, so "Sj021" alone would collide after the first use.
// "Sj021", "Sj021-a1b2", "sj021xyz" all count as you.
export function isReservedAdminPseudo(name) {
  return (name || "").trim().toLowerCase().startsWith(ADMIN_PSEUDO_BASE.toLowerCase());
}

// Inserts the profile row. If the exact pseudo is already taken AND it's the
// reserved admin pseudo, silently retries with a short random suffix instead
// of surfacing "déjà pris" — so during the iteration phase, typing "Sj021"
// always just works, no manual renaming, always recognized as admin.
export async function insertProfileWithAdminRetry(supabase, userId, desiredUsername) {
  const isAdmin = isReservedAdminPseudo(desiredUsername);
  let username = desiredUsername.trim();
  for (let attempt = 0; attempt < 5; attempt++) {
    const { error } = await supabase
      .from("profiles")
      .insert({ id: userId, username, is_admin: isAdmin });
    if (!error) return { username, isAdmin, error: null };
    if (error.code === "23505" && isAdmin) {
      username = `${ADMIN_PSEUDO_BASE}-${Math.random().toString(36).slice(2, 6)}`;
      continue;
    }
    return { username, isAdmin, error };
  }
  return { username, isAdmin, error: { message: "Impossible de créer le profil." } };
}
