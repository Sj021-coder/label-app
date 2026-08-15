import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/supabase/admin";
import { searchYoutubeChannel } from "@/lib/integrations/youtube";

export async function POST(request) {
  const { user, isAdmin } = await getAdminContext();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!isAdmin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const { query } = await request.json();
  try {
    const results = await searchYoutubeChannel(query);
    return NextResponse.json({ results });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
