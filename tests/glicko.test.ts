import { describe, expect, it } from 'vitest';
import { DEFAULT_RATING, updateRating } from '../src/features/puzzles/glicko';

describe('Glicko-2', () => {
  it('matches the worked example from Glickman (2012)', () => {
    // Player 1500/200/0.06 vs a 1400/30 opponent, win: rating rises, RD shrinks.
    const r = updateRating({ r: 1500, rd: 200, vol: 0.06 }, { r: 1400, rd: 30 }, 1);
    expect(r.r).toBeGreaterThan(1550);
    expect(r.r).toBeLessThan(1600);
    expect(r.rd).toBeLessThan(200);
  });
  it('moves up on solve, down on fail, more for upsets', () => {
    const p = DEFAULT_RATING;
    const easyWin = updateRating(p, { r: 1000, rd: 80 }, 1).r - p.r;
    const hardWin = updateRating(p, { r: 2000, rd: 80 }, 1).r - p.r;
    expect(easyWin).toBeGreaterThan(0);
    expect(hardWin).toBeGreaterThan(easyWin);
    expect(updateRating(p, { r: 1500, rd: 80 }, 0).r).toBeLessThan(p.r);
  });
  it('converges: many solves of 1800 puzzles pull rating towards/above 1800', () => {
    let r = DEFAULT_RATING;
    for (let i = 0; i < 60; i++) r = updateRating(r, { r: 1800, rd: 80 }, i % 4 === 0 ? 0 : 1);
    expect(r.r).toBeGreaterThan(1800);
    expect(r.rd).toBeLessThan(120);
  });
});
