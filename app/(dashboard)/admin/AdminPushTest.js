"use client";

import { useState } from "react";

// Standalone test button — proves the whole push pipe works end to end
// (subscribe -> stored -> sent -> delivered) before trusting it's wired
// correctly into any real trigger (Pick'em resolution, etc).
export default function AdminPushTest() {
  const [status, setStatus] = useState(""); // "", "sending", "ok", "error"
  const [message, setMessage] = useState("");

  async function sendTest() {
    setStatus("sending");
    setMessage("");
    const res = await fetch("/api/push/test", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setStatus("ok");
      setMessage(`Envoyé à ${data.sent} appareil(s). Regarde ton téléphone.`);
    } else {
      setStatus("error");
      setMessage(data.error || "Échec de l'envoi.");
    }
  }

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 mt-3">
      <div className="text-sm font-bold mb-1">🔔 Tester une notification</div>
      <p className="text-xs text-[var(--text-faint)] mb-3">
        Envoie une vraie notification à ton propre compte, sur tous tes appareils abonnés.
        Assure-toi d&apos;avoir activé les notifications d&apos;abord (bandeau en haut des pages).
      </p>
      <button
        onClick={sendTest}
        disabled={status === "sending"}
        className="text-xs font-bold px-4 py-2 rounded-full bg-[var(--gold)] text-[#1a1310]"
      >
        {status === "sending" ? "Envoi..." : "Envoyer un test"}
      </button>
      {message && (
        <p className={`text-xs mt-2 ${status === "ok" ? "text-[var(--gold)]" : "text-[var(--crimson)]"}`}>
          {message}
        </p>
      )}
    </div>
  );
}
