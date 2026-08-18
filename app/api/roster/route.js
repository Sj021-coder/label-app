import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { BUDGET_TOTAL, ROSTER_SIZE, totalCost, TRANSFER_PENALTY } from "@/lib/gameRules";
import { getWeeklyProgram, formatCountdown } from "@/lib/weeklyProgram";

export async function POST(request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { artistId } = await request.json();

  const [{ data: currentRoster }, { data: artist }] = await Promise.all([
    supabase
      .from("roster_entries")
      .select("artist_id, artists(cost)")
      .eq("user_id", user.id),
    supabase.from("artists").select("id, cost").eq("id", artistId).single(),
  ]);

  if (!artist) return NextResponse.json({ error: "Artist not found" }, { status: 404 });

  const currentCost = totalCost((currentRoster || []).map((r) => r.artists));
  if (currentCost + artist.cost > BUDGET_TOTAL) {
    return NextResponse.json(
      { error: `Budget exceeded. You have ${BUDGET_TOTAL - currentCost}M left, this artist costs ${artist.cost}M.` },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("roster_entries")
    .insert({ user_id: user.id, artist_id: artistId });

  if (error) {
    // DB trigger raises an exception if roster already has 7 artists
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { artistId } = await request.json();

  // Check if roster is currently full — removing from a full roster = a transfer
  const { data: currentRoster } = await supabase
    .from("roster_entries")
    .select("artist_id")
    .eq("user_id", user.id);

  const isTransfer = (currentRoster || []).length >= ROSTER_SIZE;
  let transferInfo = null;

  if (isTransfer) {
    // Transfers only happen inside the shared weekly window — same window
    // for everyone, no more personal rolling clock. free_transfers itself
    // is refilled for the whole pool by the sync engine every Monday.
    const program = getWeeklyProgram();
    if (program.phase !== "team") {
      return NextResponse.json(
        {
          error: `La fenêtre transfert est fermée. Prochaine ouverture dans ${formatCountdown(
            program.nextAt
          )}.`,
        },
        { status: 403 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("free_transfers, penalty_points")
      .eq("id", user.id)
      .single();

    let freeTransfers = profile?.free_transfers ?? 1;
    let newPenalty = profile?.penalty_points ?? 0;
    if (freeTransfers > 0) {
      freeTransfers -= 1;
    } else {
      newPenalty += TRANSFER_PENALTY;
    }

    await supabase
      .from("profiles")
      .update({ free_transfers: freeTransfers, penalty_points: newPenalty })
      .eq("id", user.id);

    transferInfo = { freeTransfersRemaining: freeTransfers, penaltyApplied: freeTransfers === 0 };
  }

  const { error } = await supabase
    .from("roster_entries")
    .delete()
    .eq("user_id", user.id)
    .eq("artist_id", artistId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ success: true, transfer: transferInfo });
}
