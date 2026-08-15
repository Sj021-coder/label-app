import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import JoinCFlow from "./JoinCFlow";

// Onboarding variant C (S0–S8: recognition → rule → ego → draft → sim →
// result → save → handle → welcome). Isolated from variant A/B and the / flow.
export default async function JoinCPage({ searchParams }) {
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
    .order("cost", { ascending: false });

  const pick = (v) => (typeof v === "string" ? v : Array.isArray(v) ? v[0] : null);

  return (
    <JoinCFlow
      artists={artists || []}
      sourceId={pick(sp.s)}
      crewCode={pick(sp.crew)}
      referrerId={pick(sp.r)}
    />
  );
}
