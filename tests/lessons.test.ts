import { afterAll, describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { LESSONS } from '../src/content/lessons';
import { validateLesson } from '../src/features/lessons/validate';
import { winPctFor } from '../src/chess/evalMath';
import { createNodeEngine } from './nodeEngine';

describe('lesson content: static', () => {
  it('has unique ids', () => {
    expect(new Set(LESSONS.map((l) => l.id)).size).toBe(LESSONS.length);
  });
  for (const lesson of LESSONS) {
    it(`${lesson.id} is well-formed`, () => {
      expect(validateLesson(lesson)).toEqual([]);
    });
  }
});

/** Engine checks: each user move in a solution is (near-)best, and "play" goals are achievable from the start. */
describe('lesson content: engine', () => {
  const engine = createNodeEngine();
  afterAll(() => engine.quit());

  it('solution moves are sound and play positions are winnable/holdable', async () => {
    const problems: string[] = [];
    for (const lesson of LESSONS) {
      for (const [i, step] of lesson.steps.entries()) {
        const where = `${lesson.id} step ${i + 1}`;
        if (step.type === 'move') {
          const c = new Chess(step.fen);
          for (let k = 0; k < step.solution.length; k += 2) {
            const fen = c.fen();
            const mover = c.turn();
            const u = step.solution[k];
            const best = await engine.analyze(fen, { depth: 14 });
            c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
            const afterScore = c.isCheckmate() ? { mate: mover === 'w' ? 1 : -1 } : (await engine.analyze(c.fen(), { depth: 14 })).lines[0]?.score ?? { cp: 0 };
            const loss = winPctFor(best.lines[0].score, mover) - winPctFor(afterScore, mover);
            if (loss > 8) problems.push(`${where}: ${u} loses ${loss.toFixed(1)}% vs ${best.bestMove}`);
            if (k + 1 < step.solution.length) {
              const r = step.solution[k + 1];
              c.move({ from: r.slice(0, 2), to: r.slice(2, 4), promotion: r[4] });
            }
          }
        }
        if (step.type === 'play') {
          const r = await engine.analyze(step.fen, { depth: 16 });
          const side = step.fen.split(' ')[1] as 'w' | 'b';
          const w = winPctFor(r.lines[0].score, side);
          if (step.goal === 'hold' && w < 30) problems.push(`${where}: hold position looks lost (${w.toFixed(0)}%)`);
          if (step.goal !== 'hold' && w < 80) problems.push(`${where}: ${step.goal} position not clearly winning (${w.toFixed(0)}%)`);
        }
      }
    }
    expect(problems).toEqual([]);
  }, 300_000);
});
