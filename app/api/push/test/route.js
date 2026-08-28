import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendPushToUser } from "@/lib/push/send";

// Sends a real push to whoever is logged in, to themselves — the fastest
// way to prove the whole pipe (permission -> subscribe -> stored -> sent
// -> delivered) actually works end to end before wiring it to real events.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { sent } = await sendPushToUser(user.id, {
    title: "LABEL — Test",
    body: "Si tu vois ça, les notifications marchent. 🎉",
    url: "/roster",
  });

  if (sent === 0) {
    return NextResponse.json(
      { error: "Aucun appareil abonné trouvé pour ton compte." },
      { status: 404 }
    );
  }
  return NextResponse.json({ success: true, sent });
}
