import { Chess } from 'chess.js';
import { db, type GameRecord } from '../../db/db';

/** Validate a single PGN and store it; returns the new game id. */
export async function saveGame(pgn: string, source: GameRecord['source']): Promise<number> {
  const chess = new Chess();
  chess.loadPgn(pgn); // throws on invalid PGN
  const h = chess.getHeaders() as Record<string, string>;
  const id = await db.games.add({
    pgn,
    white: h.White || 'White',
    black: h.Black || 'Black',
    result: h.Result || '*',
    date: h.Date || '',
    source,
    addedAt: Date.now(),
  });
  return id as number;
}

export async function deleteGame(id: number) {
  await db.transaction('rw', db.games, db.reviews, async () => {
    await db.games.delete(id);
    await db.reviews.delete(id);
  });
}

/** Summary of a PGN for listing before import. */
export function pgnSummary(pgn: string): { label: string; ok: boolean; error?: string } {
  try {
    const chess = new Chess();
    chess.loadPgn(pgn);
    const h = chess.getHeaders() as Record<string, string>;
    const moves = Math.ceil(chess.history().length / 2);
    return { ok: true, label: `${h.White ?? '?'} vs ${h.Black ?? '?'} · ${h.Result ?? '*'} · ${moves} moves${h.Date ? ` · ${h.Date}` : ''}` };
  } catch (e) {
    return { ok: false, label: pgn.slice(0, 60), error: (e as Error).message };
  }
}
