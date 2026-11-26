import { Chess, type Square, type PieceSymbol } from 'chess.js';
import type { Score } from '../../engine/types';
import { winPctFor } from '../../chess/evalMath';
import { captureGain } from '../../chess/see';
import type { Classification } from './types';

export const PIECE_VALUE: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

export interface ClassifyInput {
  fenBefore: string;
  uci: string;
  /** Best engine line's score before the move (White POV). */
  bestScore: Score;
  /** Second-best line's score before the move, if MultiPV ≥ 2 found one. */
  secondScore?: Score;
  bestUci: string | null;
  /** Score after the move (White POV). */
  afterScore: Score;
  /** Position is still in the opening book after this move. */
  inBook?: boolean;
  /** Mover-POV win% loss of the opponent's previous move (undefined at ply 1). */
  prevOpponentLoss?: number;
  /** Mover-POV win% before the opponent's previous move. */
  winBeforeOpponentMove?: number;
}

export interface ClassifyResult {
  classification: Classification;
  winBefore: number;
  winAfter: number;
  loss: number;
}

/** Thresholds on mover-POV win% loss (0–100 scale = expected points × 100). */
export const LOSS = { excellent: 2, good: 5, inaccuracy: 10, mistake: 20 } as const;

export function classifyMove(input: ClassifyInput): ClassifyResult {
  const color = input.fenBefore.split(' ')[1] === 'b' ? 'b' : 'w';
  const winBefore = winPctFor(input.bestScore, color);
  const winAfterRaw = winPctFor(input.afterScore, color);
  const isBest = input.bestUci !== null && input.uci === input.bestUci;
  // The played best move can't be worse than "best"; depth noise between searches is ignored.
  const winAfter = isBest ? Math.max(winAfterRaw, winBefore) : winAfterRaw;
  const loss = Math.max(0, winBefore - winAfter);
  const res = (classification: Classification): ClassifyResult => ({ classification, winBefore, winAfter, loss });

  if (input.inBook) return res('book');

  const legalCount = new Chess(input.fenBefore).moves().length;
  const nearBest = isBest || loss <= 1;

  if (nearBest && legalCount > 1) {
    // In an already-won position a sacrifice only counts if it forces mate where alternatives don't (as fast).
    const mateFor = (s: Score | undefined) =>
      s?.mate !== undefined && s.mate !== 0 && (color === 'w') === s.mate > 0 ? Math.abs(s.mate) : null;
    const bestMate = mateFor(input.bestScore);
    const secondMate = mateFor(input.secondScore);
    const forcingMate = bestMate !== null && (secondMate === null || secondMate > bestMate + 1);
    if (isSacrifice(input.fenBefore, input.uci) && winAfter >= 50 && (winBefore < 90 || forcingMate)) {
      return res('brilliant');
    }
    if (input.secondScore) {
      const winSecond = winPctFor(input.secondScore, color);
      const gap = winAfter - winSecond;
      // Only move that holds: big gap to the alternative, and the position wasn't already trivially decided.
      if (gap >= 15 && winBefore < 97 && !isObviousRecapture(input.fenBefore, input.uci)) return res('great');
    }
  }
  if (isBest) return res('best');
  if (loss <= LOSS.excellent) return res('excellent');
  if (loss <= LOSS.good) return res('good');
  if (loss <= LOSS.inaccuracy) return res('inaccuracy');

  // A miss: opponent just erred, and this move gives most of that gift back.
  if (
    input.prevOpponentLoss !== undefined &&
    input.prevOpponentLoss >= LOSS.inaccuracy &&
    input.winBeforeOpponentMove !== undefined &&
    winAfter <= input.winBeforeOpponentMove + 5
  ) {
    return res('miss');
  }
  if (loss <= LOSS.mistake) return res('mistake');
  return res('blunder');
}

/**
 * Piece sacrifice: after the move, some piece of the mover worth ≥ 3 (the moved piece, or one it leaves exposed)
 * can be won by the opponent per static exchange evaluation, for a net loss of ≥ 2 after accounting for anything the
 * move itself captured — and that wasn't already true before the move.
 */
export function isSacrifice(fenBefore: string, uci: string): boolean {
  const chess = new Chess(fenBefore);
  const mover = chess.turn();
  const opp = mover === 'w' ? 'b' : 'w';
  let move;
  try {
    move = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  } catch {
    return false;
  }
  if (chess.isCheckmate()) return false;
  const captured = move.captured ? PIECE_VALUE[move.captured] : 0;
  const before = new Chess(fenBefore);
  for (const row of chess.board()) {
    for (const p of row) {
      if (!p || p.color !== mover || p.type === 'k' || PIECE_VALUE[p.type] < 3) continue;
      const lost = captureGain(chess, p.square, opp);
      if (lost - captured < 2) continue;
      // Already en prise before this move (same piece, same square)? Then the move didn't sacrifice it.
      const unmoved = p.square !== move.to && before.get(p.square)?.type === p.type;
      if (unmoved && captureGain(before, p.square, opp) >= lost) continue;
      return true;
    }
  }
  return false;
}

/** The move recaptures on the square where the opponent's last capture happened (approximated: captures an attacker-equal piece). */
function isObviousRecapture(fenBefore: string, uci: string): boolean {
  const chess = new Chess(fenBefore);
  const to = uci.slice(2, 4) as Square;
  const target = chess.get(to);
  if (!target) return false;
  // A capture of a piece that's at least as valuable as ours and was just placed there is the "obvious" case.
  const ours = chess.get(uci.slice(0, 2) as Square);
  return !!ours && PIECE_VALUE[target.type] >= PIECE_VALUE[ours.type] && PIECE_VALUE[target.type] >= 3;
}
