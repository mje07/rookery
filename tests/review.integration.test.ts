import { afterAll, describe, expect, it } from 'vitest';
import { analyzeGame } from '../src/features/review/analyzeGame';
import { treeFromPgn } from '../src/chess/tree';
import { createNodeEngine } from './nodeEngine';
import { loadBookFromDisk, OPERA_GAME } from './helpers';

const engine = createNodeEngine();
afterAll(() => engine.quit());

describe('full game review with real Stockfish', () => {
  it('reviews the Opera Game sensibly', async () => {
    const review = await analyzeGame(treeFromPgn(OPERA_GAME), engine, loadBookFromDisk(), { depth: 12 });
    const by = (san: string) => review.plies.find((p) => p.san === san)!;
    console.log(
      review.plies.map((p) => `${p.san}:${p.classification}`).join(' '),
      '\naccuracy',
      review.accuracy,
      review.rating,
      review.opening,
    );
    expect(review.plies).toHaveLength(33);
    expect(review.opening?.name).toMatch(/Philidor/);
    expect(by('e4').classification).toBe('book');
    expect(review.accuracy.w).toBeGreaterThan(review.accuracy.b);
    const blackErrors = review.plies.filter(
      (p) => p.color === 'b' && ['mistake', 'blunder', 'miss', 'inaccuracy'].includes(p.classification),
    );
    expect(blackErrors.length).toBeGreaterThan(2);
    expect(['best', 'great', 'brilliant']).toContain(by('Rd8#').classification);
    expect(by('Qb8+').classification).toBe('brilliant');
    for (const p of review.plies) expect(p.explanation.length).toBeGreaterThan(5);
  }, 240_000);
});
