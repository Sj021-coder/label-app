import webpush from "web-push";
import { createServiceClient } from "@/lib/supabase/service";

let configured = false;
function ensureConfigured() {
  if (configured) return;
  webpush.setVapidDetails(
    "mailto:samanjmor21@gmail.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  configured = true;
}

// Sends a real push notification to every device a user has enabled
// notifications on (a phone AND a laptop both get it — that's intentional).
// Dead subscriptions (permission revoked, app uninstalled — Web Push
// answers 404/410 for these) are pruned automatically so the table doesn't
// slowly fill with addresses nothing can ever be delivered to again.
export async function sendPushToUser(userId, { title, body, url }) {
  ensureConfigured();
  const supabase = createServiceClient();
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (!subs || subs.length === 0) return { sent: 0 };

  let sent = 0;
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title, body, url })
        );
        sent++;
      } catch (e) {
        if (e.statusCode === 404 || e.statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        }
        // Any other error: swallow per-device. One bad subscription must
        // never block the rest of this user's devices, or a caller looping
        // over many users (e.g. every Pick'em voter).
      }
    })
  );
  return { sent };
}

// Fan-out for "notify this whole list of users" call sites.
export async function sendPushToUsers(userIds, payload) {
  const uniqueIds = [...new Set(userIds)];
  await Promise.all(uniqueIds.map((id) => sendPushToUser(id, payload)));
}
