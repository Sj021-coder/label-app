export default function VinylAvatar({ initials, color, size = 48 }) {
  return (
    <div
      className="vinyl"
      style={{ "--label-color": color, width: size, height: size }}
    >
      <span className="initials">{initials}</span>
    </div>
  );
}
