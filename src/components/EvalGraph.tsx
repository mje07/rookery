interface Props {
  /** White win% per position (0..100). */
  whiteWins: number[];
  /** Index of current position. */
  current: number;
  onSelect: (index: number) => void;
  /** Optional colored dots per position index (e.g. blunders). */
  marks?: { index: number; color: string }[];
}

/** Area chart of White's winning chances across the game; click to jump. */
export function EvalGraph({ whiteWins, current, onSelect, marks = [] }: Props) {
  const W = 600;
  const H = 90;
  const n = Math.max(whiteWins.length - 1, 1);
  const x = (i: number) => (i / n) * W;
  const y = (w: number) => H - (w / 100) * H;
  const pts = whiteWins.map((w, i) => `${x(i).toFixed(1)},${y(w).toFixed(1)}`).join(' ');
  const area = `0,${H} ${pts} ${W},${H}`;
  return (
    <svg
      className="eval-graph"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      onClick={(e) => {
        const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
        const i = Math.round(((e.clientX - r.left) / r.width) * n);
        onSelect(Math.max(0, Math.min(whiteWins.length - 1, i)));
      }}
      role="img"
      aria-label="Evaluation over the game"
    >
      <polygon points={area} fill="#eceae6" />
      <line x1="0" x2={W} y1={H / 2} y2={H / 2} stroke="#888" strokeWidth="0.6" strokeDasharray="3 3" />
      <line x1={x(current)} x2={x(current)} y1="0" y2={H} stroke="var(--accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      {marks.map((m) => (
        <circle key={m.index} cx={x(m.index)} cy={y(whiteWins[m.index])} r="3.5" fill={m.color} stroke="#fff" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}
