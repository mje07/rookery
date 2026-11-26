import { Chess, type PieceSymbol, type Square } from 'chess.js';
import type { Score } from '../../engine/types';
import { formatScore } from '../../chess/evalMath';
import { PIECE_VALUE } from './classify';
import type { Classification } from './types';

const NAME: Record<PieceSymbol, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };

export interface ExplainInput {
  classification: Classification;
  color: 'w' | 'b';
  fenBefore: string;
  fenAfter: string;
  san: string;
  bestSan: string | null;
  bestLine: string[];
  replyLine: string[];
  evalBefore: Score;
  evalAfter: Score;
  openingName?: string;
}

/** Material balance from `color`'s perspective. */
function material(fen: string, color: 'w' | 'b'): number {
  const chess = new Chess(fen);
  let sum = 0;
  for (const row of chess.board())
    for (const p of row) if (p) sum += (p.color === color ? 1 : -1) * PIECE_VALUE[p.type];
  return sum;
}

/** Material swing over the first `plies` of a SAN line from `fen`, from `color`'s perspective. */
function materialSwing(fen: string, line: string[], color: 'w' | 'b', plies: number): number {
  const chess = new Chess(fen);
  const start = material(fen, color);
  for (const san of line.slice(0, plies)) {
    try {
      chess.move(san);
    } catch {
      break;
    }
  }
  return material(chess.fen(), color) - start;
}

function mateFor(s: Score, color: 'w' | 'b'): number | null {
  if (s.mate === undefined || s.mate === 0) return null;
  const forMover = color === 'w' ? s.mate > 0 : s.mate < 0;
  return forMover ? Math.abs(s.mate) : -Math.abs(s.mate);
}

function firstCapture(fen: string, san: string): { piece: string; square: string } | null {
  const chess = new Chess(fen);
  try {
    const m = chess.move(san);
    if (m.captured) return { piece: NAME[m.captured], square: m.to };
  } catch {
    /* ignore */
  }
  return null;
}

/** Template-based explanation for a reviewed move. Deterministic; no external calls. */
export function explainMove(i: ExplainInput): string {
  const best = i.bestSan;
  const line = i.bestLine.slice(0, 5).join(' ');
  const mateBefore = mateFor(i.evalBefore, i.color);
  const mateAfter = mateFor(i.evalAfter, i.color);

  switch (i.classification) {
    case 'book':
      return i.openingName ? `A known opening move (${i.openingName}).` : 'A known opening move.';
    case 'brilliant': {
      const piece = sacrificedPiece(i.fenBefore, i.san, i.color);
      return piece
        ? `A sound sacrifice: the ${piece} can be taken, but accepting it doesn't work out for your opponent.`
        : 'A sound sacrifice that the engine confirms.';
    }
    case 'great':
      return 'The only good move here. Every alternative was clearly worse.';
    case 'best':
      return mateAfter && mateAfter > 0 ? `The best move. It keeps a forced mate in ${mateAfter}.` : 'The engine’s top choice.';
    case 'excellent':
      return best ? `Nearly as strong as the top move ${best}.` : 'A strong move.';
    case 'good':
      return best ? `A reasonable move, but ${best} was more precise.` : 'A reasonable move.';
  }

  // Inaccuracy / mistake / miss / blunder: say *why*.
  if (mateAfter !== null && mateAfter < 0) {
    return `This allows a forced mate in ${-mateAfter}${i.replyLine[0] ? `, starting with ${i.replyLine[0]}` : ''}.`;
  }
  if (mateBefore !== null && mateBefore > 0 && (mateAfter === null || mateAfter <= 0)) {
    return `You had a forced mate in ${mateBefore}: ${line}.`;
  }
  const reply = i.replyLine[0];
  const opp = i.color === 'w' ? 'b' : 'w';
  if (reply) {
    const swing = materialSwing(i.fenAfter, i.replyLine, opp, 4);
    const cap = firstCapture(i.fenAfter, reply);
    if (swing >= 2 && cap) {
      return `This lets ${reply} win your ${cap.piece} on ${cap.square}. ${best ? `${best} was better.` : ''}`.trim();
    }
    if (swing >= 2) {
      return `After ${reply} you lose material (about ${swing} point${swing === 1 ? '' : 's'}). ${best ? `${best} was better.` : ''}`.trim();
    }
  }
  if (i.classification === 'miss' && best) {
    const gain = materialSwing(i.fenBefore, i.bestLine, i.color, 5);
    return gain >= 2
      ? `Your opponent left something hanging. ${best} would have won material (${line}).`
      : `Your opponent's last move gave you a chance. ${best} keeps the advantage (${line}).`;
  }
  if (best) return `${best} was better (${formatScore(i.evalBefore)}). Best line: ${line}.`;
  return 'This move weakens your position.';
}

function sacrificedPiece(fenBefore: string, san: string, color: 'w' | 'b'): string | null {
  const chess = new Chess(fenBefore);
  try {
    chess.move(san);
  } catch {
    return null;
  }
  const opp = color === 'w' ? 'b' : 'w';
  let best: { v: number; name: string } | null = null;
  for (const row of chess.board()) {
    for (const p of row) {
      if (!p || p.color !== color || p.type === 'k' || p.type === 'p') continue;
      if (chess.attackers(p.square as Square, opp).length && (!best || PIECE_VALUE[p.type] > best.v)) {
        best = { v: PIECE_VALUE[p.type], name: NAME[p.type] };
      }
    }
  }
  return best?.name ?? null;
}
