import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  BUDGET_TOTAL,
  ROSTER_SIZE,
  totalCost,
  TRANSFER_BANK_CAP,
  TRANSFER_REFRESH_DAYS,
  TRANSFER_PENALTY,
} from "@/lib/gameRules";

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
    const { data: profile } = await supabase
      .from("profiles")
      .select("free_transfers, last_transfer_refresh, penalty_points")
      .eq("id", user.id)
      .single();

    let freeTransfers = profile?.free_transfers ?? 1;
    const lastRefresh = profile?.last_transfer_refresh
      ? new Date(profile.last_transfer_refresh)
      : new Date();
    const daysSinceRefresh = (Date.now() - lastRefresh.getTime()) / (1000 * 60 * 60 * 24);

    let nextRefreshDate = profile?.last_transfer_refresh;
    if (daysSinceRefresh >= TRANSFER_REFRESH_DAYS) {
      freeTransfers = Math.min(freeTransfers + 1, TRANSFER_BANK_CAP);
      nextRefreshDate = new Date().toISOString().slice(0, 10);
    }

    let newPenalty = profile?.penalty_points ?? 0;
    if (freeTransfers > 0) {
      freeTransfers -= 1;
    } else {
      newPenalty += TRANSFER_PENALTY;
    }

    await supabase
      .from("profiles")
      .update({
        free_transfers: freeTransfers,
        last_transfer_refresh: nextRefreshDate,
        penalty_points: newPenalty,
      })
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
