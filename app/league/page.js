import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function LeagueIndexPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: owned } = await supabase
      .from("leagues")
      .select("handle")
      .eq("owner_id", user.id)
      .limit(1)
      .maybeSingle();
    if (owned) redirect(`/league/${owned.handle}`);

    const { data: memberOf } = await supabase
      .from("league_members")
      .select("leagues(handle)")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    if (memberOf?.leagues?.handle) redirect(`/league/${memberOf.leagues.handle}`);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <div className="text-4xl mb-3">🏆</div>
      <div className="display text-2xl mb-2">Ligues privées</div>
      <p className="text-[var(--text-muted)] text-sm max-w-xs mb-1">
        Un classement à part, à tes couleurs, entre les gens que tu choisis.
      </p>
      <p className="text-[var(--text-faint)] text-xs max-w-xs mb-7">
        Un créateur t&apos;a envoyé un lien ? Ouvre-le directement — tu n&apos;as pas besoin
        de cette page.
      </p>
      <Link
        href="/league/create"
        className="bg-[var(--gold)] text-[#1a1310] font-extrabold uppercase tracking-wide text-sm rounded-xl py-3 px-6"
      >
        Créer ma ligue
      </Link>
    </div>
  );
}
