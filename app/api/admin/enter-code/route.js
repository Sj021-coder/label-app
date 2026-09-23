import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// TEMPORARY, pre-launch only — see lib/supabase/admin.js for why. Sets a
// cookie this browser keeps, so the code only needs to be entered once per
// device, not on every admin visit.
const ADMIN_CODE_COOKIE = "label_admin_code";
const ADMIN_CODE = "1234";

export async function POST(request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { code } = await request.json();
  if (code !== ADMIN_CODE) {
    return NextResponse.json({ error: "Code incorrect." }, { status: 403 });
  }

  const res = NextResponse.json({ success: true });
  res.cookies.set(ADMIN_CODE_COOKIE, ADMIN_CODE, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365, // 1 year — re-enter only if cleared/new device
    path: "/",
  });
  return res;
}
