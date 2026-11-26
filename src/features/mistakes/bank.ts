import { db, type MistakeCard } from '../../db/db';
import { newSrs, review as srsReview } from '../openings/sm2';
import type { Puzzle } from '../puzzles/data';
import type { ReviewData } from '../review/types';

const BANKED = new Set(['mistake', 'blunder', 'miss']);

async function addIfNew(card: Omit<MistakeCard, 'id'>): Promise<boolean> {
  const exists = await db.mistakes.where('key').equals(card.key).count();
  if (exists) return false;
  await db.mistakes.add(card as MistakeCard);
  return true;
}

/** Add the user's mistakes, misses and blunders from a reviewed game. Returns how many were added. */
export async function bankGameMistakes(gameId: number, review: ReviewData, userColor: 'white' | 'black'): Promise<number> {
  const side = userColor === 'white' ? 'w' : 'b';
  let added = 0;
  const now = Date.now();
  for (const p of review.plies) {
    if (p.color !== side || !BANKED.has(p.classification) || !p.bestUci) continue;
    const ok = await addIfNew({
      source: 'game',
      key: `game:${gameId}:${p.ply}`,
      fen: p.fenBefore,
      bestUci: p.bestUci,
      bestSan: p.bestSan ?? undefined,
      playedSan: p.san,
      lastUci: review.plies.find((q) => q.ply === p.ply - 1)?.uci,
      classification: p.classification,
      explanation: p.explanation,
      winBefore: p.winBefore,
      gameId,
      ...newSrs(now),
      createdAt: now,
    });
    if (ok) added++;
  }
  await db.games.update(gameId, { mistakesBanked: true });
  return added;
}

/** Add a failed puzzle (it comes back until it's solved reliably). */
export async function bankPuzzle(p: Puzzle): Promise<void> {
  const now = Date.now();
  await addIfNew({
    source: 'puzzle',
    key: `puzzle:${p.id}`,
    puzzle: { id: p.id, fen: p.fen, moves: p.moves, rating: p.rating, themes: p.themes },
    ...newSrs(now),
    createdAt: now,
  });
}

export async function dueMistakes(limit = 50): Promise<MistakeCard[]> {
  return db.mistakes.where('due').belowOrEqual(Date.now()).limit(limit).toArray();
}

export async function gradeMistake(card: MistakeCard, correctFirstTry: boolean) {
  await db.mistakes.put({ ...card, ...srsReview(card, correctFirstTry ? 5 : 1) });
}
