import { db, getSetting, setSetting } from '../../db/db';
import { bankPuzzle } from '../mistakes/bank';
import type { Puzzle } from './data';
import { DEFAULT_RATING, updateRating, type Rating } from './glicko';

/** Log an attempt (with themes, for roadmap gates) and send failures to the mistake trainer. */
export async function recordAttempt(puzzle: Puzzle, mode: string, solved: boolean, userRatingAfter = 0) {
  await db.puzzleAttempts.add({
    puzzleId: puzzle.id,
    mode,
    solved,
    rating: puzzle.rating,
    userRatingAfter,
    at: Date.now(),
    themes: puzzle.themes,
  });
  if (!solved) await bankPuzzle(puzzle);
}

/** Update the user's puzzle rating for a rated attempt and log it. Returns the new rating. */
export async function recordRatedAttempt(puzzle: Puzzle, mode: string, solved: boolean): Promise<{ before: Rating; after: Rating }> {
  const before = await getSetting('puzzleRating', DEFAULT_RATING);
  const after = updateRating(before, { r: puzzle.rating, rd: 80 }, solved ? 1 : 0);
  await setSetting('puzzleRating', after);
  await recordAttempt(puzzle, mode, solved, after.r);
  return { before, after };
}
