// SM-2 spaced repetition (Wozniak), adapted to chess moves.
export interface SrsState {
  ease: number;
  interval: number; // days
  reps: number;
  due: number; // epoch ms
  lapses: number;
}

const DAY = 24 * 60 * 60 * 1000;

export function newSrs(now = Date.now()): SrsState {
  return { ease: 2.5, interval: 0, reps: 0, due: now, lapses: 0 };
}

/** grade: 5 = perfect, 4 = correct, 3 = correct with hesitation/hint, <3 = wrong. */
export function review(s: SrsState, grade: number, now = Date.now()): SrsState {
  if (grade < 3) {
    // Relearn soon: 10 minutes, keep ease penalty.
    return { ease: Math.max(1.3, s.ease - 0.2), interval: 0, reps: 0, due: now + 10 * 60 * 1000, lapses: s.lapses + 1 };
  }
  const reps = s.reps + 1;
  const interval = reps === 1 ? 1 : reps === 2 ? 3 : Math.round(s.interval * s.ease);
  const ease = Math.max(1.3, s.ease + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02)));
  return { ease, interval, reps, due: now + interval * DAY, lapses: s.lapses };
}
