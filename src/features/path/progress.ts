import { db, getSetting, type GameRecord, type PuzzleAttempt } from '../../db/db';
import { DEFAULT_RATING, type Rating } from '../puzzles/glicko';
import { BOTS } from '../play/bots';
import { lessonById } from '../../content/lessons';
import { THEME_NAMES } from '../puzzles/data';
import { pathStages, STAGES, type Requirement, type Stage } from './stages';
import type { Profile } from './profile';

export interface Snapshot {
  lessonsDone: Set<string>;
  attempts: PuzzleAttempt[];
  puzzleRating: Rating;
  ratedCount: number;
  botGames: GameRecord[];
  /** Blunders+misses by the user, per reviewed bot game, newest first. */
  blunderCounts: number[];
  rushBest: number;
}

export async function loadSnapshot(): Promise<Snapshot> {
  const [progress, attempts, puzzleRating, games, rushBest] = await Promise.all([
    db.lessonProgress.toArray(),
    db.puzzleAttempts.toArray(),
    getSetting('puzzleRating', DEFAULT_RATING),
    db.games.where('source').equals('bot').toArray(),
    getSetting('best-rush', 0),
  ]);
  const botGames = games.filter((g) => g.botId && g.userColor).sort((a, b) => b.addedAt - a.addedAt);
  const reviews = await db.reviews.bulkGet(botGames.map((g) => g.id!));
  const blunderCounts: number[] = [];
  botGames.forEach((g, i) => {
    const r = reviews[i];
    if (!r) return;
    const side = g.userColor === 'white' ? 'w' : 'b';
    blunderCounts.push(r.data.counts[side].blunder + r.data.counts[side].miss);
  });
  return {
    lessonsDone: new Set(progress.filter((p) => p.completed).map((p) => p.lessonId)),
    attempts,
    puzzleRating,
    ratedCount: attempts.filter((a) => a.mode === 'rated' || a.mode.startsWith('train')).length,
    botGames,
    blunderCounts,
    rushBest,
  };
}

/** Did the user win this bot game? */
export function userWon(g: GameRecord): boolean {
  return (g.result === '1-0' && g.userColor === 'white') || (g.result === '0-1' && g.userColor === 'black');
}

export interface ReqStatus {
  req: Requirement;
  done: boolean;
  /** 0..1 */
  progress: number;
  label: string;
  detail: string;
  /** Where to go to work on it. */
  link: string;
  linkState?: unknown;
}

export function evaluate(req: Requirement, s: Snapshot): ReqStatus {
  switch (req.kind) {
    case 'lesson': {
      const l = lessonById(req.id);
      const done = s.lessonsDone.has(req.id);
      return { req, done, progress: done ? 1 : 0, label: `Lesson: ${l?.title ?? req.id}`, detail: done ? 'Completed' : 'Not started', link: `/lessons/${req.id}` };
    }
    case 'puzzles': {
      const rel = s.attempts.filter(
        (a) => a.themes?.some((t) => req.themes.includes(t)) && (req.minRating === undefined || a.rating >= req.minRating),
      );
      const solved = rel.filter((a) => a.solved).length;
      const recent = rel.sort((a, b) => b.at - a.at).slice(0, 20);
      const acc = recent.length ? Math.round((recent.filter((a) => a.solved).length / recent.length) * 100) : 0;
      const accOk = req.minAccuracy === undefined || (recent.length >= 10 && acc >= req.minAccuracy);
      const done = solved >= req.solved && accOk;
      const parts = [`${Math.min(solved, req.solved)} / ${req.solved} solved`];
      if (req.minRating) parts.push(`rated ${req.minRating}+`);
      if (req.minAccuracy) parts.push(`recent accuracy ${recent.length ? acc : '–'}% (need ${req.minAccuracy}%)`);
      return {
        req,
        done,
        progress: Math.min(1, solved / req.solved) * (accOk ? 1 : 0.9),
        label: `Puzzles: ${req.label}`,
        detail: parts.join(' · '),
        link: `/train/focus`,
        linkState: { themes: req.themes, minRating: req.minRating },
      };
    }
    case 'beatBot': {
      const bot = BOTS.find((b) => b.id === req.bot)!;
      const wins = s.botGames.filter((g) => g.botId === req.bot && userWon(g)).length;
      return {
        req,
        done: wins >= req.wins,
        progress: Math.min(1, wins / req.wins),
        label: `Beat ${bot.name} (~${bot.rating})${req.wins > 1 ? ` ${req.wins}×` : ''}`,
        detail: `${Math.min(wins, req.wins)} / ${req.wins} wins`,
        link: '/play',
        linkState: { botId: req.bot },
      };
    }
    case 'blunders': {
      const last = s.blunderCounts.slice(0, req.games);
      const avg = last.length ? last.reduce((a, b) => a + b, 0) / last.length : Infinity;
      const done = last.length >= req.games && avg <= req.max;
      return {
        req,
        done,
        progress: last.length < req.games ? (last.length / req.games) * 0.5 : done ? 1 : Math.max(0.5, Math.min(0.95, req.max / avg)),
        label: `Average ≤ ${req.max} blunders per game`,
        detail:
          last.length < req.games
            ? `Play and review ${req.games - last.length} more bot game${req.games - last.length > 1 ? 's' : ''}`
            : `Last ${req.games} reviewed games: ${avg.toFixed(1)} per game`,
        link: '/play',
      };
    }
    case 'puzzleRating': {
      const r = Math.round(s.puzzleRating.r);
      const provisional = s.puzzleRating.rd > 110;
      const done = r >= req.min && !provisional;
      return {
        req,
        done,
        progress: Math.min(1, Math.max(0, (r - 500) / (req.min - 500))),
        label: `Puzzle rating ${req.min}+`,
        detail: `Currently ${r}${provisional ? ' (provisional, keep solving rated puzzles)' : ''}`,
        link: '/puzzles',
      };
    }
    case 'rush': {
      return {
        req,
        done: s.rushBest >= req.min,
        progress: Math.min(1, s.rushBest / req.min),
        label: `Puzzle Rush score ${req.min}+`,
        detail: `Best so far: ${s.rushBest}`,
        link: '/puzzles/rush',
      };
    }
  }
}

export interface StageStatus {
  stage: Stage;
  index: number;
  reqs: ReqStatus[];
  done: boolean;
  progress: number;
}

/** Evaluate the user's roadmap: the stages between their starting level and their goal. */
export function evaluateStages(s: Snapshot, profile: Pick<Profile, 'start' | 'goal'>): { stages: StageStatus[]; current: StageStatus; complete: boolean } {
  const stages = pathStages(profile.start, profile.goal).map((stage, index) => {
    const reqs = stage.requirements.map((r) => evaluate(r, s));
    const progress = reqs.reduce((a, r) => a + r.progress, 0) / reqs.length;
    return { stage, index, reqs, done: reqs.every((r) => r.done), progress };
  });
  const current = stages.find((st) => !st.done) ?? stages[stages.length - 1];
  return { stages, current, complete: stages.every((st) => st.done) };
}

/**
 * Rough playing-strength estimate from independent signals, labelled "≈" in the UI.
 * Signals: highest bot beaten (twice → full credit), puzzle rating (Lichess puzzle ratings run high
 * relative to beginner game ratings), and the roadmap stage reached.
 */
export function estimateStrength(s: Snapshot, current: StageStatus, profile: Pick<Profile, 'start'>): number {
  const signals: number[] = [];
  let botBest = 0;
  for (const b of BOTS) {
    const wins = s.botGames.filter((g) => g.botId === b.id && userWon(g)).length;
    if (wins >= 2) botBest = Math.max(botBest, b.rating);
    else if (wins === 1) botBest = Math.max(botBest, b.rating - 100);
  }
  if (botBest) signals.push(botBest);
  if (s.puzzleRating.rd < 150) signals.push(s.puzzleRating.r - 350);
  // Progress through the current stage, never below where the user said they started.
  const stageFloor = Math.max(profile.start, current.stage.from + (current.stage.to - current.stage.from) * current.progress);
  signals.push(stageFloor);
  const avg = signals.reduce((a, b) => a + b, 0) / signals.length;
  // Self-reported start is a floor until the evidence clearly says otherwise (puzzles and bots both well below).
  const floor = profile.start - 100;
  return Math.round(Math.max(100, floor, Math.min(2600, avg)) / 25) * 25;
}

export function themeLabel(themes: string[]) {
  return themes.map((t) => THEME_NAMES[t] ?? t).join(', ');
}

export { STAGES };
