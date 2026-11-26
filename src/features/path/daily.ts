import { db, today, type DailyLog, type GameRecord } from '../../db/db';
import { BOTS } from '../play/bots';
import { lessonById } from '../../content/lessons';
import type { Snapshot, StageStatus } from './progress';
import { themeLabel } from './progress';

export type TaskId = 'warmup' | 'mistakes' | 'lesson' | 'focus' | 'game' | 'review';

export interface Task {
  id: TaskId;
  title: string;
  detail: string;
  minutes: number;
  link: string;
  linkState?: unknown;
  done: boolean;
}

export interface PuzzleSetSpec {
  themes: string[];
  count: number;
  /** Target = puzzle rating + offset. */
  ratingOffset: number;
  minRating?: number;
  mode: string;
  task?: TaskId;
  /**
   * While the puzzle rating is provisional (new users start at 1500), aim no higher than this.
   * Lichess-style puzzle ratings run roughly 300–400 above beginner game ratings.
   */
  provisionalCap?: number;
}

export interface GameSpec {
  botId: string;
  tc: string;
}

export const DAILY_OPTIONS = [20, 40, 60] as const;

function sizes(minutes: number) {
  if (minutes <= 20) return { warmup: 5, mistakes: 5, focus: 6, tc: '5+3' };
  if (minutes <= 40) return { warmup: 6, mistakes: 8, focus: 10, tc: '10+5' };
  return { warmup: 8, mistakes: 12, focus: 15, tc: '15+10' };
}

/** Bot games the user started today (newest first). */
export function todaysBotGames(s: Snapshot): GameRecord[] {
  const start = new Date().setHours(0, 0, 0, 0);
  return s.botGames.filter((g) => g.addedAt >= start);
}

export function buildPlan(opts: {
  snapshot: Snapshot;
  current: StageStatus;
  minutes: number;
  log: DailyLog | undefined;
  dueMistakes: number;
  todaysGameReviewed: boolean;
}): Task[] {
  const { current, minutes, log, dueMistakes, snapshot } = opts;
  const st = current.stage;
  const n = sizes(minutes);
  const done = log?.done ?? {};
  const tasks: Task[] = [];

  const cap = st.to + 350;
  const warm: PuzzleSetSpec = { themes: st.themes, count: n.warmup, ratingOffset: -300, mode: 'train-warmup', task: 'warmup', provisionalCap: cap };
  tasks.push({
    id: 'warmup',
    title: 'Warm-up puzzles',
    detail: `${n.warmup} easy puzzles · ${themeLabel(st.themes.slice(0, 3))}`,
    minutes: Math.round(n.warmup * 0.8),
    link: '/train/puzzles',
    linkState: warm,
    done: !!done.warmup,
  });

  if (dueMistakes > 0 || done.mistakes) {
    tasks.push({
      id: 'mistakes',
      title: 'Fix your past mistakes',
      detail: done.mistakes ? 'Reviewed' : `${Math.min(dueMistakes, n.mistakes)} positions you got wrong before`,
      minutes: Math.round(Math.min(dueMistakes || n.mistakes, n.mistakes) * 0.75),
      link: '/train/mistakes',
      linkState: { limit: n.mistakes },
      done: !!done.mistakes,
    });
  }

  const nextLesson = current.reqs.find((r) => r.req.kind === 'lesson' && !r.done);
  if (nextLesson || done.lesson) {
    const id = nextLesson?.req.kind === 'lesson' ? nextLesson.req.id : undefined;
    tasks.push({
      id: 'lesson',
      title: id ? `Lesson: ${lessonById(id)?.title}` : 'Lesson',
      detail: done.lesson ? 'Completed today' : 'Learn the idea, then play it on the board',
      minutes: 8,
      link: id ? `/lessons/${id}` : '/lessons',
      done: !!done.lesson,
    });
  }

  const puzzleReq = current.reqs.find((r) => r.req.kind === 'puzzles' && !r.done) ?? current.reqs.find((r) => r.req.kind === 'puzzles');
  const focusThemes = puzzleReq?.req.kind === 'puzzles' ? puzzleReq.req.themes : st.themes;
  const focusMin = puzzleReq?.req.kind === 'puzzles' ? puzzleReq.req.minRating : undefined;
  const focus: PuzzleSetSpec = { themes: focusThemes, count: n.focus, ratingOffset: 0, minRating: focusMin, mode: 'train-focus', task: 'focus', provisionalCap: cap };
  tasks.push({
    id: 'focus',
    title: 'Focus puzzles',
    detail: `${n.focus} rated puzzles · ${themeLabel(focusThemes.slice(0, 3))}${focusThemes.length > 3 ? '…' : ''}`,
    minutes: Math.round(n.focus * 1.2),
    link: '/train/puzzles',
    linkState: focus,
    done: !!done.focus,
  });

  // Play the stage bot; if it's already been beaten enough, step up to the next bot.
  const botReq = current.reqs.find((r) => r.req.kind === 'beatBot' && !r.done);
  const botId = botReq?.req.kind === 'beatBot' ? botReq.req.bot : st.bot;
  const bot = BOTS.find((b) => b.id === botId)!;
  const played = todaysBotGames(snapshot);
  tasks.push({
    id: 'game',
    title: `Play ${bot.name} (~${bot.rating})`,
    detail: `${n.tc.replace('+', ' | ')} game. Do the blunder check on every move`,
    minutes: n.tc === '5+3' ? 10 : n.tc === '10+5' ? 20 : 30,
    link: '/play',
    linkState: { botId, tc: n.tc } satisfies GameSpec,
    done: played.length > 0,
  });
  tasks.push({
    id: 'review',
    title: 'Review that game',
    detail: 'Your mistakes go straight into tomorrow’s practice',
    minutes: 5,
    link: played[0] ? `/review/${played[0].id}` : '/review',
    done: opts.todaysGameReviewed,
  });
  return tasks;
}

export async function markDone(task: TaskId) {
  const date = today();
  const log = (await db.dailyLog.get(date)) ?? { date, done: {} };
  log.done = { ...log.done, [task]: true };
  await db.dailyLog.put(log);
}

/** Days in a row (ending today, or yesterday if today isn't finished yet) with at least 3 tasks done. */
export async function streak(): Promise<number> {
  const logs = new Map((await db.dailyLog.toArray()).map((l) => [l.date, l]));
  const counts = (d: string) => Object.values(logs.get(d)?.done ?? {}).filter(Boolean).length >= 3;
  const d = new Date();
  if (!counts(today(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (counts(today(d))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}
