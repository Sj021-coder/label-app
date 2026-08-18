"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// The missing piece all session: anonymous accounts had no way to leave a
// browser session, so an old test account would silently block onboarding
// (the "/" page skips straight to /roster once you're logged in).
export default function SignOutButton() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  async function signOut() {
    setLoading(true);
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <button
      onClick={signOut}
      disabled={loading}
      className="text-[10px] text-[var(--text-faint)] underline disabled:opacity-50"
    >
      {loading ? "…" : "Se déconnecter"}
    </button>
  );
}
