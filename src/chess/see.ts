import { Chess, type Color, type PieceSymbol, type Square } from 'chess.js';

export const SEE_VALUE: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };

/** Least valuable piece of `side` attacking `sq` on `board`. */
function leastValuableAttacker(board: Chess, sq: Square, side: Color): { from: Square; type: PieceSymbol } | null {
  let best: { from: Square; type: PieceSymbol } | null = null;
  for (const from of board.attackers(sq, side)) {
    const p = board.get(from);
    if (p && (!best || SEE_VALUE[p.type] < SEE_VALUE[best.type])) best = { from, type: p.type };
  }
  return best;
}

/**
 * Static exchange evaluation: material `side` nets (in pawns) by starting a capture sequence on `sq`, with
 * both sides always recapturing with their least valuable piece and free to stop when continuing loses.
 * Returns ≤ 0 if the first capture doesn't pay, 0 if there is nothing to capture. X-rays are handled because
 * pieces are physically removed from the board as they capture.
 */
export function see(position: Chess | string, sq: Square, side: Color): number {
  const board = new Chess(typeof position === 'string' ? position : position.fen(), { skipValidation: true });
  const target = board.get(sq);
  if (!target || target.color === side) return 0;

  const other = (c: Color): Color => (c === 'w' ? 'b' : 'w');
  let atk = leastValuableAttacker(board, sq, side);
  if (!atk) return 0;
  // A king can't make the first capture onto a defended square.
  if (atk.type === 'k' && board.attackers(sq, other(side)).length > 0) return 0;

  // gain[d] = net material for the side making capture d, if the sequence stopped right after it.
  const gain: number[] = [SEE_VALUE[target.type]];
  let turn: Color = side;
  let d = 0;
  for (;;) {
    // `atk` (of colour `turn`) captures on sq.
    board.remove(atk.from);
    board.remove(sq);
    board.put({ type: atk.type, color: turn }, sq);
    const onSquare = atk.type;
    turn = other(turn);
    const next = leastValuableAttacker(board, sq, turn);
    if (!next) break;
    // A king may only recapture if the square is no longer defended.
    if (next.type === 'k' && board.attackers(sq, other(turn)).length > 0) break;
    d++;
    gain[d] = SEE_VALUE[onSquare] - gain[d - 1];
    if (Math.max(-gain[d - 1], gain[d]) < 0) break; // continuing can't help either side
    atk = next;
  }
  // Each side may decline to continue: unwind with minimax.
  for (; d > 0; d--) gain[d - 1] = -Math.max(-gain[d - 1], gain[d]);
  return gain[0] + 0; // normalise -0
}

/** Material `byColor` can win by capturing on `sq` (0 if nothing worth taking): the opponent's best case. */
export function captureGain(position: Chess | string, sq: Square, byColor: Color): number {
  return Math.max(0, see(position, sq, byColor));
}
