import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendPushToUser } from "@/lib/push/send";
import { getWeeklyProgram, formatCountdown } from "@/lib/weeklyProgram";
import { getWeeklyFact } from "@/lib/weeklyFact";

// Identity-language headline, same wording as WeeklyBanner — this endpoint
// exists so the real weekly-window notification (not yet wired into the
// engine) can be felt right now, on a real phone, with real content,
// instead of a generic "it works!" line.
const HEADLINE = {
  team: "🧢 Aux commandes de ton label",
  predictions: "🔮 Le pari du patron",
};

// Sends a real push to whoever is logged in, to themselves — proves the
// whole pipe (permission -> subscribe -> stored -> sent -> delivered)
// works end to end, AND doubles as a live preview of what the automatic
// weekly trigger will eventually send, using the exact same real data.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const program = getWeeklyProgram();
  const fact = program.phase !== "quiet" ? await getWeeklyFact(supabase, user.id, program.phase) : null;

  const title = "LABEL.";
  const body =
    program.phase !== "quiet"
      ? `${HEADLINE[program.phase]}${fact ? " — " + fact : ""}`
      : `Programme de la semaine — prochaine ouverture dans ${formatCountdown(program.nextAt)}.`;
  const url = program.phase === "predictions" ? "/pickem" : "/roster";

  const { sent } = await sendPushToUser(user.id, { title, body, url });

  if (sent === 0) {
    return NextResponse.json(
      { error: "Aucun appareil abonné trouvé pour ton compte." },
      { status: 404 }
    );
  }
  return NextResponse.json({ success: true, sent });
}
