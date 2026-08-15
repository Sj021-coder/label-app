import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/supabase/admin";

export async function POST(request) {
  const { supabase, user, isAdmin } = await getAdminContext();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!isAdmin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const { question, optionA, optionB, artistAId, artistBId, closesAt } = await request.json();

  const { error } = await supabase.from("predictions").insert({
    question,
    option_a: optionA,
    option_b: optionB,
    artist_a_id: artistAId || null,
    artist_b_id: artistBId || null,
    closes_at: closesAt,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
