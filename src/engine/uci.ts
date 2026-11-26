import type { PvLine, Score } from './types';

/** Side to move from a FEN ('w' | 'b'). */
export function sideToMove(fen: string): 'w' | 'b' {
  return fen.split(' ')[1] === 'b' ? 'b' : 'w';
}

/**
 * Parse a UCI `info` line. Returns null for lines without a score/pv (e.g. currmove updates).
 * Scores are converted from side-to-move POV to White POV.
 */
export function parseInfo(line: string, fen: string): PvLine | null {
  if (!line.startsWith('info ') || !line.includes(' pv ') || !line.includes(' score ')) return null;
  // Ignore bound-only scores; they are provisional.
  if (/ (lowerbound|upperbound) /.test(line)) return null;
  const tok = line.split(/\s+/);
  let depth = 0;
  let multipv = 1;
  let score: Score | null = null;
  let pv: string[] = [];
  for (let i = 1; i < tok.length; i++) {
    const t = tok[i];
    if (t === 'depth') depth = parseInt(tok[++i], 10);
    else if (t === 'multipv') multipv = parseInt(tok[++i], 10);
    else if (t === 'score') {
      const kind = tok[++i];
      const val = parseInt(tok[++i], 10);
      score = kind === 'mate' ? { mate: val } : { cp: val };
    } else if (t === 'pv') {
      pv = tok.slice(i + 1);
      break;
    }
  }
  if (!score || pv.length === 0) return null;
  if (sideToMove(fen) === 'b') {
    score = score.mate !== undefined ? { mate: -score.mate } : { cp: -(score.cp as number) };
  }
  return { depth, multipv, score, pv };
}

export function parseBestMove(line: string): string | null | undefined {
  if (!line.startsWith('bestmove')) return undefined;
  const mv = line.split(/\s+/)[1];
  return !mv || mv === '(none)' ? null : mv;
}
