"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Generic "something real just changed, go get fresh data" trigger.
// Subscribes to a Realtime table/event and asks Next.js to re-fetch this
// server component — instead of re-implementing every page's query logic a
// second time in client-side JS (what RosterClient does, because Roster
// also needs the flash/delta animation). Renders nothing; drop it anywhere
// on a server-rendered page that should feel alive without a manual reload.
// Debounced so one sync-run batch (dozens of artist UPDATEs at once)
// triggers a single refresh, not dozens.
export default function LiveRefresh({ table, event = "*", channelName }) {
  const router = useRouter();
  const timeoutRef = useRef(null);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(channelName || `live-refresh-${table}-${event}`)
      .on("postgres_changes", { event, schema: "public", table }, () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          router.refresh();
        }, 800);
      })
      .subscribe();

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      supabase.removeChannel(channel);
    };
  }, [table, event, channelName, router]);

  return null;
}
