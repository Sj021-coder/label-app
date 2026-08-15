import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import JoinFlow from "./JoinFlow";

// Solo onboarding entry (S1). Acquisition context arrives as query params:
//   ?s=<source_id>   ?r=<referrer_id>   ?crew=<code> (set by /c/[code])
export default async function JoinPage({ searchParams }) {
  const sp = (await searchParams) || {};
  const supabase = await createClient();

  // Someone who already finished onboarding shouldn't see it again.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .single();
    if (profile) redirect("/roster");
  }

  const { data: artists } = await supabase
    .from("artists")
    .select("id, name, initials, color, score, cost, tier, value, image_url")
    .order("cost", { ascending: false });

  const pick = (v) => (typeof v === "string" ? v : Array.isArray(v) ? v[0] : null);

  return (
    <JoinFlow
      artists={artists || []}
      sourceId={pick(sp.s)}
      crewCode={pick(sp.crew)}
      referrerId={pick(sp.r)}
    />
  );
}
