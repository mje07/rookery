import { Chess } from 'chess.js';
import type { AnalysisResult, AnalyzeOptions, Score } from '../../engine/types';

/** The subset of EngineService the review needs (lets tests use a Node-hosted engine). */
export interface ReviewEngine {
  analyze(fen: string, opts: AnalyzeOptions): Promise<AnalysisResult>;
  newGame(): Promise<void>;
}
import { gameAccuracy, estimateRating, moveAccuracy, winPct } from '../../chess/evalMath';
import { mainline, uciLineToSan, type MoveTree } from '../../chess/tree';
import type { OpeningBook } from '../openings/book';
import { openingOf } from '../openings/book';
import { classifyMove } from './classify';
import { explainMove } from './explain';
import type { Classification, PlyReview, ReviewData } from './types';

export const ALL_CLASSES: Classification[] = [
  'brilliant', 'great', 'best', 'excellent', 'good', 'book', 'inaccuracy', 'mistake', 'miss', 'blunder',
];

/** Eval of a terminal position (no engine lines): mate or draw, White POV. */
function terminalScore(fen: string): Score | null {
  const chess = new Chess(fen);
  if (chess.isCheckmate()) return { mate: chess.turn() === 'w' ? -1 : 1 }; // side to move is mated
  if (chess.isDraw() || chess.isStalemate()) return { cp: 0 };
  return null;
}

/** Normalised score of an analysed position. Positions with "mate 0" are mapped to a decisive score. */
function positionScore(fen: string, r: AnalysisResult): Score {
  const t = terminalScore(fen);
  if (t) return t;
  return r.lines[0]?.score ?? { cp: 0 };
}

export interface AnalyzeProgress {
  done: number;
  total: number;
}

/** Analyse every position on the main line and classify each move. */
export async function analyzeGame(
  tree: MoveTree,
  engine: ReviewEngine,
  book: OpeningBook,
  opts: {
    /** Node budget per position (preferred: even quality, predictable time). */
    nodes?: number;
    /** Fixed depth per position (used by tests / when no node budget is given). */
    depth?: number;
    onProgress?: (p: AnalyzeProgress) => void;
    /** Called with a review of the moves analysed so far, after each position. */
    onPartial?: (r: ReviewData) => void;
    signal?: AbortSignal;
  },
): Promise<ReviewData> {
  const nodes = mainline(tree);
  const results: AnalysisResult[] = [];
  await engine.newGame();
  for (let i = 0; i < nodes.length; i++) {
    if (opts.signal?.aborted) throw new DOMException('aborted', 'AbortError');
    const fen = nodes[i].fen;
    const terminal = terminalScore(fen);
    results.push(
      terminal
        ? { fen, depth: 0, bestMove: null, lines: [] }
        : await engine.analyze(fen, {
            nodes: opts.nodes,
            depth: opts.nodes ? undefined : opts.depth ?? 14,
            multiPV: 2,
            signal: opts.signal,
          }),
    );
    opts.onProgress?.({ done: i + 1, total: nodes.length });
    if (opts.onPartial && i >= 1 && i < nodes.length - 1) opts.onPartial(buildReview(tree, results, book));
  }
  if (opts.signal?.aborted) throw new DOMException('aborted', 'AbortError');
  return buildReview(tree, results, book);
}

/**
 * Pure part: turn per-position engine results into a review. Exported for tests.
 * `results` may cover only a prefix of the game (partial review while analysis is running).
 */
export function buildReview(tree: MoveTree, results: AnalysisResult[], book: OpeningBook): ReviewData {
  const nodes = mainline(tree).slice(0, Math.max(1, results.length));
  const scores = nodes.map((n, i) => positionScore(n.fen, results[i]));
  const plies: PlyReview[] = [];
  const counts = { w: emptyCounts(), b: emptyCounts() };
  let stillBook = true;
  const opening = openingOf(book, nodes.slice(1).map((n) => n.fen));

  for (let i = 1; i < nodes.length; i++) {
    const before = nodes[i - 1];
    const node = nodes[i];
    const rBefore = results[i - 1];
    const rAfter = results[i];
    const color = before.fen.split(' ')[1] === 'b' ? 'b' : 'w';
    stillBook = stillBook && book.inBook(node.fen);
    const prev = plies[plies.length - 1];

    // Score of the played move: if the search of the position before already evaluated it (it's one of the
    // MultiPV lines), use that — same search, so no depth noise between "best" and "played".
    const sameSearch = rBefore.lines.find((l) => l.pv[0] === node.uci)?.score;
    const afterScore = terminalScore(node.fen) ?? sameSearch ?? scores[i];

    const c = classifyMove({
      fenBefore: before.fen,
      uci: node.uci,
      bestScore: scores[i - 1],
      secondScore: rBefore.lines[1]?.score,
      bestUci: rBefore.bestMove,
      afterScore,
      inBook: stillBook,
      prevOpponentLoss: prev ? Math.max(0, prev.winBefore - prev.winAfter) : undefined,
      winBeforeOpponentMove: prev ? 100 - prev.winBefore : undefined,
    });
    const bestLine = rBefore.lines[0] ? uciLineToSan(before.fen, rBefore.lines[0].pv.slice(0, 10)) : [];
    const replyLine = rAfter.lines[0] ? uciLineToSan(node.fen, rAfter.lines[0].pv.slice(0, 8)) : [];
    const ply: PlyReview = {
      nodeId: node.id,
      ply: node.ply,
      color,
      san: node.san,
      uci: node.uci,
      fenBefore: before.fen,
      fenAfter: node.fen,
      evalBefore: scores[i - 1],
      evalAfter: afterScore,
      bestUci: rBefore.bestMove,
      bestSan: bestLine[0] ?? null,
      bestLine,
      replyLine,
      winBefore: c.winBefore,
      winAfter: c.winAfter,
      accuracy: moveAccuracy(c.winBefore, c.winAfter),
      classification: c.classification,
      explanation: '',
    };
    ply.explanation = explainMove({ ...ply, openingName: book.nameAt(node.fen)?.name ?? opening?.name });
    counts[color][c.classification]++;
    plies.push(ply);
  }

  const whiteWins = scores.map((s) => winPct(s));
  const firstMover = nodes[0].fen.split(' ')[1] === 'b' ? 'b' : 'w';
  const accuracy = gameAccuracy(whiteWins, firstMover);
  return {
    startFen: nodes[0].fen,
    headers: tree.headers,
    plies,
    accuracy,
    rating: { w: estimateRating(accuracy.w), b: estimateRating(accuracy.b) },
    counts,
    opening,
    whiteWins,
  };
}

function emptyCounts(): Record<Classification, number> {
  return Object.fromEntries(ALL_CLASSES.map((c) => [c, 0])) as Record<Classification, number>;
}
