import { createClient } from "@/lib/supabase/server";

// Central admin check. Returns { supabase, user, isAdmin }.
// `isAdmin` is only true when the logged-in user's profile has is_admin = true.
// If the is_admin column doesn't exist yet (migration not run), this safely
// resolves to isAdmin = false — i.e. admin stays locked, which is the safe default.
export async function getAdminContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { supabase, user: null, isAdmin: false };

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  return { supabase, user, isAdmin: !!(profile && profile.is_admin) };
}
