import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSharedWeek } from "@/lib/weeklyProgram";

export async function POST(request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { mode, opponentUserId } = await request.json();
  const { end: weekEnd } = getSharedWeek();

  const { data: existing } = await supabase
    .from("user_duels")
    .select("id")
    .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
    .gte("week_end", new Date().toISOString())
    .limit(1);
  if (existing && existing.length) {
    return NextResponse.json({ error: "Tu as déjà un duel en cours." }, { status: 400 });
  }

  let opponentId = opponentUserId;

  if (mode === "random") {
    const { data: busyRows } = await supabase
      .from("user_duels")
      .select("user_a_id, user_b_id")
      .gte("week_end", new Date().toISOString());
    const busy = new Set([user.id]);
    for (const d of busyRows || []) {
      busy.add(d.user_a_id);
      busy.add(d.user_b_id);
    }
    const { data: candidates } = await supabase.from("profiles").select("id").limit(200);
    const eligible = (candidates || []).filter((p) => !busy.has(p.id));
    if (!eligible.length) {
      return NextResponse.json({ error: "Personne de disponible pour l'instant." }, { status: 400 });
    }
    opponentId = eligible[Math.floor(Math.random() * eligible.length)].id;
  } else {
    if (!opponentId || opponentId === user.id) {
      return NextResponse.json({ error: "Choisis un adversaire valide." }, { status: 400 });
    }
    const { data: oppBusy } = await supabase
      .from("user_duels")
      .select("id")
      .or(`user_a_id.eq.${opponentId},user_b_id.eq.${opponentId}`)
      .gte("week_end", new Date().toISOString())
      .limit(1);
    if (oppBusy && oppBusy.length) {
      return NextResponse.json({ error: "Cette personne a déjà un duel en cours." }, { status: 400 });
    }
  }

  const { error: insErr } = await supabase.from("user_duels").insert({
    user_a_id: user.id,
    user_b_id: opponentId,
    mode: mode === "random" ? "random" : "chosen",
    week_end: weekEnd.toISOString(),
  });
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
