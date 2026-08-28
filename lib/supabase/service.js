import { createClient } from "@supabase/supabase-js";

// Service-role client for server-only code that needs to act across users —
// e.g. sending a push notification to every voter on a resolved prediction,
// not just whoever is currently logged in. Bypasses RLS entirely. Never
// import this into anything that ships to the browser.
export function createServiceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}
