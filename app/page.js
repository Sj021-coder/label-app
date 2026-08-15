import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DraftOnboarding from "./DraftOnboarding";

export default async function Home() {
  const supabase = await createClient();
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
    .select("id, name, initials, color, score, cost, tier, image_url")
    .order("name");

  return <DraftOnboarding artists={artists || []} />;
}
