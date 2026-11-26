import { describe, expect, it } from 'vitest';
import type { GameRecord, PuzzleAttempt } from '../src/db/db';
import { DEFAULT_RATING } from '../src/features/puzzles/glicko';
import { estimateStrength, evaluate, evaluateStages, userWon, type Snapshot } from '../src/features/path/progress';
import { buildPlan } from '../src/features/path/daily';
import { MAX_RATING, pathStages, STAGES } from '../src/features/path/stages';

const P = { start: 200, goal: 1000 };
import { BOTS } from '../src/features/play/bots';
import { lessonById } from '../src/content/lessons';
import { THEME_NAMES } from '../src/features/puzzles/data';

function snap(p: Partial<Snapshot> = {}): Snapshot {
  return {
    lessonsDone: new Set(),
    attempts: [],
    puzzleRating: DEFAULT_RATING,
    ratedCount: 0,
    botGames: [],
    blunderCounts: [],
    rushBest: 0,
    ...p,
  };
}
const attempt = (themes: string[], solved: boolean, rating = 800, at = Date.now()): PuzzleAttempt => ({
  puzzleId: Math.random().toString(36),
  mode: 'rated',
  solved,
  rating,
  userRatingAfter: 1000,
  at,
  themes,
});
const botGame = (botId: string, result: string, userColor: 'white' | 'black' = 'white'): GameRecord => ({
  pgn: '',
  white: '',
  black: '',
  result,
  date: '',
  source: 'bot',
  addedAt: Date.now(),
  botId,
  userColor,
});

describe('roadmap definition', () => {
  it('references real lessons, bots and puzzle themes', () => {
    for (const st of STAGES) {
      expect(BOTS.some((b) => b.id === st.bot)).toBe(true);
      for (const t of st.themes) expect(THEME_NAMES[t], t).toBeDefined();
      for (const r of st.requirements) {
        if (r.kind === 'lesson') expect(lessonById(r.id), r.id).toBeDefined();
        if (r.kind === 'beatBot') expect(BOTS.some((b) => b.id === r.bot), r.bot).toBe(true);
        if (r.kind === 'puzzles') for (const t of r.themes) expect(THEME_NAMES[t], t).toBeDefined();
      }
    }
  });
  it('covers the whole range without gaps', () => {
    expect(STAGES[0].from).toBe(100);
    expect(STAGES[STAGES.length - 1].to).toBe(MAX_RATING);
    for (let i = 1; i < STAGES.length; i++) expect(STAGES[i].from).toBe(STAGES[i - 1].to);
  });
  it('builds a roadmap for any start and goal', () => {
    const ids = (a: number, b: number) => pathStages(a, b).map((s) => s.id);
    expect(ids(200, 1000)).toEqual(['first-steps', 'stop-hanging', 'basic-mates', 'forks', 'pins-skewers', 'openings', 'endgames', 'consistency']);
    expect(ids(1200, 1600)).toEqual(['rook-endgames', 'attack-defence', 'quiet-moves']);
    expect(ids(650, 750)).toEqual(['pins-skewers', 'openings']);
    expect(ids(1500, 5000).at(-1)).toBe('mastery');
    // goal at/below start still yields at least one stage
    expect(pathStages(900, 900).length).toBeGreaterThan(0);
  });
});

describe('gate evaluation', () => {
  it('counts wins by colour', () => {
    expect(userWon(botGame('pip', '1-0', 'white'))).toBe(true);
    expect(userWon(botGame('pip', '1-0', 'black'))).toBe(false);
    expect(userWon(botGame('pip', '0-1', 'black'))).toBe(true);
  });
  it('puzzle gates need the count and recent accuracy', () => {
    const req = { kind: 'puzzles' as const, themes: ['fork'], solved: 5, minAccuracy: 70, label: 'Forks' };
    const few = evaluate(req, snap({ attempts: [attempt(['fork'], true)] }));
    expect(few.done).toBe(false);
    // 10 solved but only 50% recent accuracy -> not done yet
    const sloppy = Array.from({ length: 20 }, (_, i) => attempt(['fork', 'middlegame'], i % 2 === 0, 800, i));
    expect(evaluate(req, snap({ attempts: sloppy })).done).toBe(false);
    const good = Array.from({ length: 12 }, (_, i) => attempt(['fork'], i % 6 !== 0, 800, i));
    expect(evaluate(req, snap({ attempts: good })).done).toBe(true);
    // other themes don't count
    expect(evaluate(req, snap({ attempts: good.map((a) => ({ ...a, themes: ['pin'] })) })).done).toBe(false);
  });
  it('blunder gate needs enough reviewed games under the cap', () => {
    const req = { kind: 'blunders' as const, max: 2, games: 3 };
    expect(evaluate(req, snap({ blunderCounts: [1, 1] })).done).toBe(false);
    expect(evaluate(req, snap({ blunderCounts: [1, 2, 3, 9] })).done).toBe(true);
    expect(evaluate(req, snap({ blunderCounts: [4, 2, 3] })).done).toBe(false);
  });
  it('provisional puzzle ratings do not pass rating gates', () => {
    const req = { kind: 'puzzleRating' as const, min: 1000 };
    expect(evaluate(req, snap({ puzzleRating: { r: 1200, rd: 300, vol: 0.06 } })).done).toBe(false);
    expect(evaluate(req, snap({ puzzleRating: { r: 1200, rd: 70, vol: 0.06 } })).done).toBe(true);
  });
});

describe('stages and strength', () => {
  it('starts at stage 1 and advances when gates are met', () => {
    expect(evaluateStages(snap(), P).current.index).toBe(0);
    const s1 = snap({
      lessonsDone: new Set(['pieces', 'check-mate', 'special-moves']),
      attempts: Array.from({ length: 10 }, () => attempt(['mateIn1'], true)),
      botGames: [botGame('pip', '1-0')],
    });
    const { stages, current } = evaluateStages(s1, P);
    expect(stages[0].done).toBe(true);
    expect(current.index).toBe(1);
  });
  it('estimates strength within the roadmap range and rewards beating bots', () => {
    const base = snap();
    const { current } = evaluateStages(base, P);
    const s0 = estimateStrength(base, current, P);
    expect(s0).toBeGreaterThanOrEqual(200);
    const stronger = snap({ botGames: [botGame('juniper', '1-0'), botGame('juniper', '0-1', 'black')] });
    expect(estimateStrength(stronger, evaluateStages(stronger, P).current, P)).toBeGreaterThan(s0);
  });
  it('a 1200 player starts at their level, not at stage one', () => {
    const p = { start: 1200, goal: 1600 };
    const { current, stages } = evaluateStages(snap(), p);
    expect(stages[0].stage.id).toBe('rook-endgames');
    expect(current.stage.id).toBe('rook-endgames');
    expect(estimateStrength(snap(), current, p)).toBeGreaterThanOrEqual(1100);
  });
});

describe('daily plan', () => {
  it('scales with time and includes a game and its review', () => {
    const s = snap();
    const { current } = evaluateStages(s, P);
    const short = buildPlan({ snapshot: s, current, minutes: 20, log: undefined, dueMistakes: 0, todaysGameReviewed: false });
    const long = buildPlan({ snapshot: s, current, minutes: 60, log: undefined, dueMistakes: 30, todaysGameReviewed: false });
    const ids = (t: typeof short) => t.map((x) => x.id);
    expect(ids(short)).toEqual(['warmup', 'lesson', 'focus', 'game', 'review']);
    expect(ids(long)).toContain('mistakes');
    const total = (t: typeof short) => t.reduce((a, x) => a + x.minutes, 0);
    expect(total(long)).toBeGreaterThan(total(short));
    expect(long.find((t) => t.id === 'game')!.linkState).toMatchObject({ botId: 'pip' });
  });
  it('marks logged tasks done', () => {
    const s = snap();
    const { current } = evaluateStages(s, P);
    const plan = buildPlan({ snapshot: s, current, minutes: 40, log: { date: 'x', done: { warmup: true } }, dueMistakes: 0, todaysGameReviewed: true });
    expect(plan.find((t) => t.id === 'warmup')!.done).toBe(true);
    expect(plan.find((t) => t.id === 'review')!.done).toBe(true);
    expect(plan.find((t) => t.id === 'focus')!.done).toBe(false);
  });
});
