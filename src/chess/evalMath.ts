import type { Score } from '../engine/types';

/** Centipawn value used for mate scores in arithmetic. */
export const MATE_CP = 10000;

/** Convert a White-POV score to centipawns, mapping mates to large values (closer mate = larger). */
export function scoreToCp(s: Score): number {
  if (s.mate !== undefined) {
    if (s.mate === 0) return 0; // shouldn't happen for a side-to-move-mated position; caller handles
    return Math.sign(s.mate) * (MATE_CP - Math.abs(s.mate) * 10);
  }
  return s.cp ?? 0;
}

/**
 * Win percentage for White (0–100) from a centipawn eval, using the logistic model
 * fitted by Lichess (published in lila's source, AGPL; the constant is a fact of the fit).
 */
export function winPctFromCp(cp: number): number {
  const c = Math.max(-1000, Math.min(1000, cp));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * c)) - 1);
}

export function winPct(s: Score): number {
  if (s.mate !== undefined) return s.mate > 0 ? 100 : s.mate < 0 ? 0 : 50;
  return winPctFromCp(s.cp ?? 0);
}

/** Win% from the perspective of a given color. */
export function winPctFor(s: Score, color: 'w' | 'b'): number {
  const w = winPct(s);
  return color === 'w' ? w : 100 - w;
}

/** Per-move accuracy (0–100) from win% before and after, both from the mover's perspective. */
export function moveAccuracy(winBefore: number, winAfter: number): number {
  if (winAfter >= winBefore) return 100;
  const diff = winBefore - winAfter;
  const raw = 103.1668100711649 * Math.exp(-0.04354415386753951 * diff) - 3.166924740191411;
  return Math.max(0, Math.min(100, raw + 1)); // +1 uncertainty bonus
}

function mean(xs: number[]) {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
function stdev(xs: number[]) {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}
function harmonicMean(xs: number[]) {
  const pos = xs.map((x) => Math.max(x, 0.5));
  return pos.length / pos.reduce((a, b) => a + 1 / b, 0);
}

/**
 * Game accuracy for each side: average of a volatility-weighted mean and a harmonic mean
 * of per-move accuracies (same idea as Lichess). `whiteWins` is the White win% before each ply
 * and after the last (length = plies + 1).
 */
export function gameAccuracy(whiteWins: number[], firstMover: 'w' | 'b' = 'w'): { w: number; b: number } {
  const plies = whiteWins.length - 1;
  if (plies < 1) return { w: 100, b: 100 };
  const windowSize = Math.max(2, Math.min(8, Math.floor(plies / 10)));
  // Volatility weight per ply: stdev of win% over a trailing window (early plies share the first window).
  const weights: number[] = [];
  for (let i = 0; i < plies; i++) {
    const end = Math.min(whiteWins.length, Math.max(windowSize, i + 2));
    const w = whiteWins.slice(Math.max(0, end - windowSize), end);
    weights.push(Math.max(0.5, Math.min(12, stdev(w))));
  }

  const acc: Record<'w' | 'b', { a: number; wt: number }[]> = { w: [], b: [] };
  for (let i = 0; i < plies; i++) {
    const color: 'w' | 'b' = (i % 2 === 0) === (firstMover === 'w') ? 'w' : 'b';
    const before = color === 'w' ? whiteWins[i] : 100 - whiteWins[i];
    const after = color === 'w' ? whiteWins[i + 1] : 100 - whiteWins[i + 1];
    acc[color].push({ a: moveAccuracy(before, after), wt: weights[i] });
  }
  const side = (xs: { a: number; wt: number }[]) => {
    if (!xs.length) return 100;
    const wsum = xs.reduce((s, x) => s + x.wt, 0);
    const weighted = xs.reduce((s, x) => s + x.a * x.wt, 0) / wsum;
    const harm = harmonicMean(xs.map((x) => x.a));
    return (weighted + harm) / 2;
  };
  return { w: side(acc.w), b: side(acc.b) };
}

/** Rough performance-rating estimate from game accuracy. A heuristic, labelled as such in the UI. */
export function estimateRating(accuracy: number): number {
  // Piecewise-linear map tuned so ~50% ≈ 600, ~75% ≈ 1300, ~85% ≈ 1800, ~92% ≈ 2300, 97%+ ≈ 2800.
  const pts: [number, number][] = [
    [30, 250], [50, 600], [65, 1000], [75, 1300], [85, 1800], [92, 2300], [97, 2800], [100, 3100],
  ];
  if (accuracy <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    const [a0, r0] = pts[i - 1];
    const [a1, r1] = pts[i];
    if (accuracy <= a1) return Math.round((r0 + ((accuracy - a0) / (a1 - a0)) * (r1 - r0)) / 50) * 50;
  }
  return 3100;
}

/** Human-readable score for display, e.g. "+1.24", "-0.50", "#3", "#-2". */
export function formatScore(s: Score | undefined): string {
  if (!s) return '…';
  if (s.mate !== undefined) return s.mate === 0 ? '#' : `#${s.mate}`;
  const v = (s.cp ?? 0) / 100;
  return (v > 0 ? '+' : '') + v.toFixed(2);
}
