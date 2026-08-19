import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TeamCreateForm from "./TeamCreateForm";

export default async function CreateTeamPage() {
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

  // Unlike Creator Leagues (one per creator), a person can be on SEVERAL
  // teams at once — so no "already have one" redirect here.
  return <TeamCreateForm suggestedName={`Team ${profile.username}`} />;
}
