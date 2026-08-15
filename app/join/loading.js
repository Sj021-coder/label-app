// S0 — if the plateau isn't instant, show a skeleton that already looks like
// the game (grid + budget bar), never a spinner. Familiarity + effort-prediction.
export default function JoinLoading() {
  return (
    <div className="min-h-screen px-4 pt-4">
      <div className="h-6 w-40 skeleton rounded mb-4" />
      <div className="h-2 w-full skeleton rounded-full mb-2" />
      <div className="h-4 w-32 skeleton rounded mb-6" />
      <div className="grid grid-cols-3 gap-2.5">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="aspect-[3/4] skeleton rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
