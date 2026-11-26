import type { Score } from '../../engine/types';

export type Classification =
  | 'brilliant'
  | 'great'
  | 'best'
  | 'excellent'
  | 'good'
  | 'book'
  | 'inaccuracy'
  | 'mistake'
  | 'miss'
  | 'blunder';

export interface PlyReview {
  nodeId: string;
  ply: number;
  color: 'w' | 'b';
  san: string;
  uci: string;
  fenBefore: string;
  fenAfter: string;
  /** Engine eval of the position before the move (White POV). */
  evalBefore: Score;
  /** Engine eval after the move (White POV). */
  evalAfter: Score;
  bestUci: string | null;
  bestSan: string | null;
  /** Best continuation from fenBefore, SAN. */
  bestLine: string[];
  /** Opponent's best reply line after the played move, SAN (refutation for mistakes). */
  replyLine: string[];
  /** Mover-POV win% before / after. */
  winBefore: number;
  winAfter: number;
  accuracy: number;
  classification: Classification;
  explanation: string;
}

export interface ReviewData {
  startFen: string;
  headers: Record<string, string>;
  plies: PlyReview[];
  accuracy: { w: number; b: number };
  rating: { w: number; b: number };
  counts: Record<'w' | 'b', Record<Classification, number>>;
  opening?: { eco: string; name: string };
  /** White win% at each position (length plies+1), for the graph. */
  whiteWins: number[];
}
