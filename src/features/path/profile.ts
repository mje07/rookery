import { db, getSetting, setSetting } from '../../db/db';
import { DEFAULT_RATING, type Rating } from '../puzzles/glicko';
import { clampRating } from './stages';

/** The user's self-reported starting level and goal. */
export interface Profile {
  start: number;
  goal: number;
  setAt: number;
}

export async function loadProfile(): Promise<Profile | null> {
  return getSetting<Profile | null>('profile', null);
}

/**
 * Save the profile. If the puzzle rating hasn't been established yet, seed it from the stated level
 * (puzzle ratings run roughly 300–400 above game ratings at club level), so the first puzzles fit.
 */
export async function saveProfile(start: number, goal: number): Promise<Profile> {
  const s = clampRating(start);
  const profile: Profile = { start: s, goal: Math.max(clampRating(goal), s + 50), setAt: Date.now() };
  await setSetting('profile', profile);
  const pr = await getSetting<Rating>('puzzleRating', DEFAULT_RATING);
  // Re-seed if the rating is still unestablished, or if the user corrected their level by a lot early on.
  const ratedSoFar = await db.puzzleAttempts.filter((a) => a.userRatingAfter > 0).count();
  const expected = s + 350;
  if (pr.rd > 200 || (ratedSoFar < 40 && Math.abs(pr.r - expected) > 400)) {
    await setSetting('puzzleRating', { r: Math.max(500, Math.min(2600, s + 350)), rd: 250, vol: 0.09 } satisfies Rating);
  }
  return profile;
}

export const LEVEL_PRESETS: { label: string; rating: number; hint: string }[] = [
  { label: 'New to chess', rating: 100, hint: 'Still learning how the pieces move' },
  { label: 'Beginner', rating: 400, hint: 'Know the rules, lose pieces often' },
  { label: 'Casual', rating: 800, hint: 'Play online sometimes' },
  { label: 'Club', rating: 1200, hint: 'Know basic tactics and openings' },
  { label: 'Strong club', rating: 1600, hint: 'Solid tactics, some theory' },
  { label: 'Advanced', rating: 1900, hint: 'Tournament experience' },
];
