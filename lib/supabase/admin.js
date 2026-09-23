import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

// TEMPORARY, pre-launch only: a shared code (see /api/admin/enter-code)
// lets ANY logged-in account into admin, instead of hand-managing is_admin
// per account while it's still just the two of us testing. Remove this
// once real users exist — a shared static code is not real access control.
const ADMIN_CODE_COOKIE = "label_admin_code";
const ADMIN_CODE = "1234";

// Central admin check. Returns { supabase, user, isAdmin }.
// `isAdmin` is true when the logged-in user's profile has is_admin = true,
// OR this browser already unlocked admin with the shared code above.
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

  const cookieStore = await cookies();
  const hasCode = cookieStore.get(ADMIN_CODE_COOKIE)?.value === ADMIN_CODE;

  return { supabase, user, isAdmin: !!(profile && profile.is_admin) || hasCode };
}
