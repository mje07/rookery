import { describe, expect, it } from 'vitest';
import { estimateRating, formatScore, gameAccuracy, moveAccuracy, scoreToCp, winPct, winPctFromCp } from '../src/chess/evalMath';

describe('win percentage', () => {
  it('is 50 at equality and symmetric', () => {
    expect(winPctFromCp(0)).toBeCloseTo(50);
    expect(winPctFromCp(300) + winPctFromCp(-300)).toBeCloseTo(100);
  });
  it('is monotonic and bounded', () => {
    expect(winPctFromCp(100)).toBeGreaterThan(winPctFromCp(50));
    expect(winPctFromCp(5000)).toBeLessThanOrEqual(100);
    expect(winPctFromCp(-5000)).toBeGreaterThanOrEqual(0);
  });
  it('treats mates as decisive', () => {
    expect(winPct({ mate: 3 })).toBe(100);
    expect(winPct({ mate: -1 })).toBe(0);
    expect(scoreToCp({ mate: 1 })).toBeGreaterThan(scoreToCp({ mate: 5 }));
  });
});

describe('accuracy', () => {
  it('gives 100 when nothing is lost', () => {
    expect(moveAccuracy(60, 60)).toBe(100);
    expect(moveAccuracy(60, 70)).toBe(100);
  });
  it('drops sharply with large losses', () => {
    expect(moveAccuracy(60, 55)).toBeGreaterThan(moveAccuracy(60, 40));
    expect(moveAccuracy(90, 10)).toBeLessThan(10);
  });
  it('rates a flat game near 100 for both sides', () => {
    const a = gameAccuracy([50, 51, 50, 52, 51, 50, 50, 51]);
    expect(a.w).toBeGreaterThan(95);
    expect(a.b).toBeGreaterThan(95);
  });
  it('punishes the side that blundered', () => {
    // White's 2nd move (index 2 -> 3) drops White from 55% to 10%.
    const a = gameAccuracy([50, 55, 55, 10, 10, 8, 8, 5]);
    expect(a.w).toBeLessThan(a.b);
  });
  it('maps accuracy to an increasing rating estimate', () => {
    expect(estimateRating(95)).toBeGreaterThan(estimateRating(80));
    expect(estimateRating(10)).toBe(250);
  });
});

describe('formatScore', () => {
  it('formats cp and mate', () => {
    expect(formatScore({ cp: 124 })).toBe('+1.24');
    expect(formatScore({ cp: -50 })).toBe('-0.50');
    expect(formatScore({ mate: -2 })).toBe('#-2');
  });
});
