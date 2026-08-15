import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/supabase/admin";

export async function POST(request) {
  const { supabase, user, isAdmin } = await getAdminContext();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!isAdmin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const { newsId } = await request.json();

  const { error } = await supabase
    .from("artist_news")
    .update({ reviewed: true })
    .eq("id", newsId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
