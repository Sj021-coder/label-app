import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import JoinBFlow from "./JoinBFlow";

// Onboarding variant B (5-page: Landing → Draft → Recap → Name → Confirm).
// Isolated from variant A (/join) and the / flow. ?hook= sets the landing
// title so it can mirror the exact promise of the link that was clicked.
export default async function JoinBPage({ searchParams }) {
  const sp = (await searchParams) || {};
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("id").eq("id", user.id).single();
    if (profile) redirect("/roster");
  }

  const { data: artists } = await supabase
    .from("artists")
    .select("id, name, initials, color, score, cost, tier, value, image_url")
    .order("name");

  const pick = (v) => (typeof v === "string" ? v : Array.isArray(v) ? v[0] : null);

  return (
    <JoinBFlow
      artists={artists || []}
      hook={pick(sp.hook)}
      sourceId={pick(sp.s)}
      crewCode={pick(sp.crew)}
      referrerId={pick(sp.r)}
    />
  );
}
