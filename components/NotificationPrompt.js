"use client";

import { useState, useEffect } from "react";
import { getNotificationSupportState, subscribeToPush } from "@/lib/push/subscribeClient";

function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

// Computed once, synchronously, as the initial state itself — not inside
// an effect — so there's no setState-in-effect cascading render. Reading
// browser APIs here is safe: this component is client-only and only ever
// runs where `window`/`Notification` exist.
function computeInitialState() {
  const support = getNotificationSupportState();
  if (support === "granted") return "hidden";
  if (support === "denied") return "hidden"; // nothing actionable without leaving the app
  if (support === "unsupported") {
    // On iPhone specifically, this is almost always fixable — Safari only
    // exposes push to an app already added to the home screen. Everywhere
    // else, "unsupported" really means unsupported.
    return isIOS() && !isStandalone() ? "ios-install" : "hidden";
  }
  return "prompt";
}

export default function NotificationPrompt() {
  const [state, setState] = useState(computeInitialState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Already granted before — resubscribe silently (idempotent upsert) in
    // case the stored subscription is stale or was never saved. Pure side
    // effect, no setState here, so no cascading-render risk.
    if (getNotificationSupportState() === "granted") {
      subscribeToPush().catch(() => {});
    }
  }, []);

  async function handleEnable() {
    setLoading(true);
    setError("");
    try {
      await subscribeToPush();
      setState("hidden");
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  if (state === "checking" || state === "hidden") return null;

  if (state === "ios-install") {
    return (
      <div className="mx-4 mb-3 bg-[var(--surface)] border border-[var(--violet)]/40 rounded-xl px-3.5 py-3 text-xs">
        <div className="font-bold mb-1">📲 Reçois les notifications sur iPhone</div>
        <p className="text-[var(--text-faint)]">
          Appuie sur <span className="font-semibold text-[var(--text)]">Partager</span> puis{" "}
          <span className="font-semibold text-[var(--text)]">« Sur l&apos;écran d&apos;accueil »</span> — ouvre
          ensuite LABEL depuis l&apos;icône ajoutée pour activer les notifications.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-4 mb-3 bg-[var(--surface)] border border-[var(--border)] rounded-xl px-3.5 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs">
          <div className="font-bold mb-0.5">🔔 Active les notifications</div>
          <p className="text-[var(--text-faint)]">
            Sois prévenu quand tes artistes bougent, tes pronostics se résolvent, ou ton bilan est prêt.
          </p>
        </div>
        <button
          onClick={handleEnable}
          disabled={loading}
          className="flex-shrink-0 text-[11px] font-bold px-3.5 py-2 rounded-full bg-[var(--gold)] text-[#1a1310]"
        >
          {loading ? "..." : "Activer"}
        </button>
      </div>
      {error && <p className="text-[var(--crimson)] text-[11px] mt-2">{error}</p>}
    </div>
  );
}
