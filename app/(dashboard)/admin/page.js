import { createClient } from "@/lib/supabase/server";
import AdminForm from "./AdminForm";

export default async function AdminPage() {
  const supabase = await createClient();

  const { data: artists } = await supabase
    .from("artists")
    .select("id, name, initials, color, score")
    .order("name");

  return (
    <div>
      <div className="text-[13px] uppercase tracking-wide text-[var(--text-faint)] font-bold mb-3">
        Moteur de scoring
      </div>
      <AdminForm artists={artists || []} />
    </div>
  );
}
