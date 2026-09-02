// Plain-language engine health, for someone who doesn't want to read logs.
// One glance should answer: "is the twice-daily robot actually alive?"
export default function SyncHealthCard({ runs }) {
  if (!runs || runs.length === 0) {
    return (
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4">
        <div className="text-sm font-bold mb-1">🤖 Moteur de score</div>
        <p className="text-xs text-[var(--text-faint)]">
          Aucun cycle enregistré pour l&apos;instant. Le premier cycle suivi
          apparaîtra ici après le prochain passage (8h ou 20h UTC).
        </p>
      </div>
    );
  }

  const last = runs[0];
  const lastOk = last.success;
  // "Healthy" = the last run worked. If it didn't, check whether the run
  // before it also failed — two in a row is a real pattern, not a blip.
  const previousAlsoFailed = !lastOk && runs[1] && !runs[1].success;

  const headline = lastOk
    ? "✅ Le moteur tourne bien"
    : previousAlsoFailed
      ? "🔴 Le moteur est en panne (2 cycles d'affilée en échec)"
      : "⚠️ Le dernier cycle a échoué";

  const headlineColor = lastOk
    ? "text-[var(--gold)]"
    : previousAlsoFailed
      ? "text-[var(--crimson)]"
      : "text-[var(--crimson)]";

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4">
      <div className="text-sm font-bold mb-1">🤖 Moteur de score</div>
      <div className={`text-base font-extrabold mb-1 ${headlineColor}`}>{headline}</div>
      <div className="text-xs text-[var(--text-faint)] mb-1">
        Dernier passage : {formatWhen(last.started_at)} · {(last.duration_ms / 1000).toFixed(0)}s
        {last.errors?.length > 0 ? ` · ${last.errors.length} souci(s)` : " · aucun souci"}
      </div>

      {/* A run killed by Netlify's ~60s hard limit shows EXACTLY 60000ms
          and never gets the chance to log a real error — this happened
          for real once already. Warning here at 45s means it's visible
          the moment margin starts disappearing, not several confused
          messages later trying to guess from a Netlify function log. */}
      {last.duration_ms >= 45000 && (
        <p className="text-[11px] text-[var(--crimson)] font-bold mb-3">
          ⚠️ Ce cycle a pris {(last.duration_ms / 1000).toFixed(0)}s, proche de la limite de 60s —
          risque réel d&apos;être coupé en plein milieu si ça continue à grimper.
        </p>
      )}
      {last.duration_ms >= 59000 && (
        <p className="text-[11px] text-[var(--crimson)] font-bold mb-3">
          🔴 Ce cycle a probablement été interrompu de force par Netlify (durée ≈ 60s) — tout ce
          qu&apos;il devait encore faire après ce point n&apos;a pas eu lieu.
        </p>
      )}

      {last.results?.releaseChecks && (
        <div className="text-[11px] text-[var(--text-faint)] mb-2">
          🔄 Vérif. des sorties (Spotify) : groupe {last.results.releaseChecks.group}/
          {last.results.releaseChecks.totalGroups} · {last.results.releaseChecks.checkedThisRun} artiste(s)
        </div>
      )}
      {last.results?.musicBrainzChecks && (
        <div className="text-[11px] text-[var(--text-faint)] mb-2">
          🔄 Vérif. de secours (MusicBrainz) : groupe {last.results.musicBrainzChecks.group}/
          {last.results.musicBrainzChecks.totalGroups} · {last.results.musicBrainzChecks.checkedThisRun} artiste(s)
        </div>
      )}
      {last.results?.kworbChecks && (
        <div className="text-[11px] text-[var(--text-faint)] mb-4">
          🔄 Vérif. des streams (kworb.net) : groupe {last.results.kworbChecks.group}/
          {last.results.kworbChecks.totalGroups} · {last.results.kworbChecks.checkedThisRun} artiste(s)
        </div>
      )}

      {last.errors?.length > 0 && (
        <div className="mb-4 bg-[var(--crimson)]/10 border border-[var(--crimson)]/30 rounded-xl p-3">
          <div className="text-[11px] uppercase tracking-wide text-[var(--crimson)] font-bold mb-1.5">
            Ce qui a coincé
          </div>
          {last.errors.slice(0, 5).map((err, i) => (
            <div key={i} className="text-xs text-[var(--text-muted)] mb-0.5">
              • {String(err)}
            </div>
          ))}
        </div>
      )}

      <div className="text-[11px] uppercase tracking-wide text-[var(--text-faint)] font-bold mb-2">
        Historique récent
      </div>
      <div className="flex gap-1 mb-3">
        {runs
          .slice(0, 12)
          .reverse()
          .map((r) => (
            <div
              key={r.id}
              title={`${formatWhen(r.started_at)} — ${r.success ? "OK" : "échec"}`}
              className={`h-2.5 flex-1 rounded-full ${r.success ? "bg-[var(--gold)]" : "bg-[var(--crimson)]"}`}
            />
          ))}
      </div>
      <p className="text-[10px] text-[var(--text-faint)]">
        Chaque barre = un cycle (8h ou 20h UTC). Vert = réussi, rouge = échec. La plus récente est à droite.
      </p>
    </div>
  );
}

function formatWhen(iso) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now - d;
  const diffH = Math.round(diffMs / 3600000);
  const time = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  if (diffH < 1) return `il y a moins d'1h (${time})`;
  if (diffH < 24) return `il y a ${diffH}h (${time})`;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) + ` à ${time}`;
}
