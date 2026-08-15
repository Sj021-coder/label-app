// Presentational KPI tiles for the Admin dashboard.
// Numbers are computed server-side in page.js and passed in.
export default function MetricsPanel({ accounts, drafted, captains, shares }) {
  const tiles = [
    { k: "Comptes créés", v: accounts, hint: "total" },
    { k: "Labels draftés", v: drafted, hint: "depuis le tracking" },
    { k: "Captains choisis", v: captains, hint: "total" },
    { k: "Partages", v: shares, hint: "depuis le tracking" },
  ];
  return (
    <div className="grid grid-cols-2 gap-2">
      {tiles.map((t) => (
        <div
          key={t.k}
          className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl px-4 py-3"
        >
          <div className="text-[10px] uppercase tracking-wide text-[var(--text-faint)] font-bold">
            {t.k}
          </div>
          <div className="mono text-2xl font-bold mt-0.5">{t.v ?? 0}</div>
          <div className="text-[10px] text-[var(--text-faint)] mt-0.5">{t.hint}</div>
        </div>
      ))}
    </div>
  );
}
