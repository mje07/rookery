import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { classifyMove, isSacrifice } from '../src/features/review/classify';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('classifyMove', () => {
  const base = { fenBefore: START, bestUci: 'e2e4', bestScore: { cp: 30 } };
  it('book overrides everything', () => {
    expect(classifyMove({ ...base, uci: 'g2g4', afterScore: { cp: -200 }, inBook: true }).classification).toBe('book');
  });
  it('best when matching engine move, even with search noise', () => {
    expect(classifyMove({ ...base, uci: 'e2e4', afterScore: { cp: 10 } }).classification).toBe('best');
  });
  it('grades by win% loss', () => {
    const c = (cp: number) => classifyMove({ ...base, uci: 'a2a3', afterScore: { cp } }).classification;
    expect(c(25)).toBe('excellent');
    expect(c(0)).toBe('good');
    expect(c(-60)).toBe('inaccuracy');
    expect(c(-150)).toBe('mistake');
    expect(c(-600)).toBe('blunder');
  });
  it('flags missed mates as errors rather than best', () => {
    const r = classifyMove({ ...base, bestScore: { mate: 2 }, uci: 'a2a3', afterScore: { cp: 50 } });
    expect(['blunder', 'miss']).toContain(r.classification);
  });
  it('detects a miss after the opponent erred', () => {
    const r = classifyMove({
      ...base,
      bestScore: { cp: 400 },
      uci: 'a2a3',
      afterScore: { cp: 20 },
      prevOpponentLoss: 30,
      winBeforeOpponentMove: 52,
    });
    expect(r.classification).toBe('miss');
  });
  it('great when best and the alternative is much worse', () => {
    const r = classifyMove({ ...base, uci: 'e2e4', bestScore: { cp: 20 }, secondScore: { cp: -400 }, afterScore: { cp: 20 } });
    expect(r.classification).toBe('great');
  });
  it('mirrors perspective for Black', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
    const r = classifyMove({ fenBefore: fen, uci: 'f7f6', bestUci: 'e7e5', bestScore: { cp: 30 }, afterScore: { cp: 600 } });
    expect(r.classification).toBe('blunder');
  });
});

describe('isSacrifice', () => {
  it('spots the knight sacrifice on f7 (Fried Liver)', () => {
    const c = new Chess();
    for (const m of ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5', 'd5', 'exd5', 'Nxd5']) c.move(m);
    expect(isSacrifice(c.fen(), 'g5f7')).toBe(true);
  });
  it('does not count an even trade', () => {
    const c = new Chess();
    for (const m of ['e4', 'd5']) c.move(m);
    expect(isSacrifice(c.fen(), 'e4d5')).toBe(false);
  });
  it('does not count a quiet developing move', () => {
    expect(isSacrifice(START, 'g1f3')).toBe(false);
  });
});
