import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CreateLeagueForm from "./CreateLeagueForm";

export default async function CreateLeaguePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/");

  // A creator only needs one league for the MVP — send them straight to it
  // if they already have one instead of letting them spawn duplicates.
  const { data: existing } = await supabase
    .from("leagues")
    .select("handle")
    .eq("owner_id", user.id)
    .limit(1)
    .maybeSingle();
  if (existing) redirect(`/league/${existing.handle}`);

  return <CreateLeagueForm suggestedName={`La Ligue de ${profile.username}`} />;
}
