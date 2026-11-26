import { Chess, type Square, type PieceSymbol } from 'chess.js';
import type { Score } from '../../engine/types';
import { winPctFor } from '../../chess/evalMath';
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

/** Attackers of `sq` belonging to `by`, as square list. */
function attackers(chess: Chess, sq: Square, by: 'w' | 'b'): Square[] {
  return chess.attackers(sq, by);
}

function lowestAttackerValue(chess: Chess, sq: Square, by: 'w' | 'b'): number {
  let min = Infinity;
  for (const a of attackers(chess, sq, by)) {
    const p = chess.get(a);
    if (p) min = Math.min(min, p.type === 'k' ? 100 : PIECE_VALUE[p.type]);
  }
  return min;
}

/**
 * Heuristic piece sacrifice: after the move, a piece of the mover worth ≥ 3 (the moved one, or one it
 * leaves behind) can be taken for a net material loss — attacked and undefended, or attacked by a
 * cheaper piece — and the move itself didn't capture something of at least that value.
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
  const captured = move.captured ? PIECE_VALUE[move.captured] : 0;
  if (chess.isCheckmate()) return false;
  const board = chess.board();
  for (const row of board) {
    for (const p of row) {
      if (!p || p.color !== mover || p.type === 'k' || p.type === 'p') continue;
      const value = PIECE_VALUE[p.type];
      if (value < 3) continue;
      const atk = lowestAttackerValue(chess, p.square, opp);
      // Not attacked, or only the king attacks a defended piece: it can't be won.
      if (atk === Infinity || (atk === 100 && attackers(chess, p.square, mover).length > 0)) continue;
      const defended = attackers(chess, p.square, mover).length > 0;
      const hanging = !defended || atk < value;
      if (!hanging) continue;
      // Material actually given up: what they win minus what we took this move.
      const net = (defended ? value - atk : value) - captured;
      if (net >= 2) {
        // If the piece was already hanging before the move, the move didn't sacrifice it.
        const before = new Chess(fenBefore);
        const stillThere = p.square !== move.to && before.get(p.square)?.type === p.type;
        if (stillThere) {
          const bAtk = lowestAttackerValue(before, p.square, opp);
          const bDef = attackers(before, p.square, mover).length > 0;
          if (bAtk !== Infinity && (!bDef || bAtk < value)) continue;
        }
        return true;
      }
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
