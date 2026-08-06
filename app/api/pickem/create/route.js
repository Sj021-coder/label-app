import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

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
