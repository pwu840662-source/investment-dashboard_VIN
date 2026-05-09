/** 依數列繪製迷你走勢（SVG）；至少需 2 個點 */
export function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = span * 0.06;
  const lo = min - pad;
  const hi = max + pad;
  const range = hi - lo || 1;

  const w = 100;
  const h = 38;
  const coords = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - lo) / range) * h;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  const stroke = values[values.length - 1] >= values[0] ? "var(--up)" : "var(--down)";

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      role="img"
      aria-hidden
      style={{ width: "100%", height: 46, display: "block", marginTop: "0.35rem" }}
    >
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        points={coords.join(" ")}
      />
    </svg>
  );
}
