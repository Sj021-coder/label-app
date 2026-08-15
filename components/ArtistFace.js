// Shared artist avatar — shows the real photo everywhere, for everyone.
// Falls back to initials-on-color if an artist has no photo yet.
export default function ArtistFace({ imageUrl, initials, color, name, size = 40 }) {
  const dim = typeof size === "number" ? `${size}px` : size;
  const fontPx = typeof size === "number" ? Math.max(10, Math.round(size * 0.4)) : 18;
  return (
    <div
      className="rounded-full overflow-hidden flex-none flex items-center justify-center font-extrabold"
      style={{
        width: dim,
        height: dim,
        background: imageUrl ? "var(--surface-2)" : color,
        color: "#1a1310",
        fontSize: `${fontPx}px`,
      }}
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt={name || ""} className="w-full h-full object-cover" />
      ) : (
        initials
      )}
    </div>
  );
}
