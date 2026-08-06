import { createClient } from "@/lib/supabase/server";
import AdminForm from "./AdminForm";
import AdminPickem from "./AdminPickem";
import AdminMapping from "./AdminMapping";

export default async function AdminPage() {
  const supabase = await createClient();

  const { data: artists } = await supabase
    .from("artists")
    .select("id, name, initials, color, score, spotify_id, youtube_channel_id")
    .order("name");

  const { data: predictions } = await supabase
    .from("predictions")
    .select("id, question, option_a, option_b, correct_option, closes_at")
    .order("created_at", { ascending: false })
    .limit(15);

  const { data: newsItems } = await supabase
    .from("artist_news")
    .select("id, title, url, source, artist_id, artists(name)")
    .eq("reviewed", false)
    .order("fetched_at", { ascending: false })
    .limit(20);

  return (
    <div>
      <div className="text-[13px] uppercase tracking-wide text-[var(--text-faint)] font-bold mb-3">
        Moteur de scoring
      </div>
      <AdminForm artists={artists || []} />

      <div className="mt-10 pt-6 border-t border-[var(--border)]">
        <div className="text-[13px] uppercase tracking-wide text-[var(--text-faint)] font-bold mb-3">
          Gestion Pick&apos;em
        </div>
        <AdminPickem artists={artists || []} predictions={predictions || []} />
      </div>

      <div className="mt-10 pt-6 border-t border-[var(--border)]">
        <div className="text-[13px] uppercase tracking-wide text-[var(--text-faint)] font-bold mb-3">
          IDs API (Spotify / YouTube) & Actualités
        </div>
        <AdminMapping artists={artists || []} newsItems={newsItems || []} />
      </div>
    </div>
  );
}
