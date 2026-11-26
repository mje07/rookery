import { describe, expect, it } from 'vitest';
import { parseBestMove, parseInfo } from '../src/engine/uci';

const W = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const B = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';

describe('UCI parsing', () => {
  it('parses info lines and converts to White POV', () => {
    const l = 'info depth 12 seldepth 16 multipv 2 score cp 35 nodes 1000 pv e7e5 g1f3';
    expect(parseInfo(l, W)).toEqual({ depth: 12, multipv: 2, score: { cp: 35 }, pv: ['e7e5', 'g1f3'] });
    expect(parseInfo(l, B)!.score).toEqual({ cp: -35 });
    expect(parseInfo('info depth 5 score mate 3 pv a1a2', B)!.score).toEqual({ mate: -3 });
  });
  it('ignores bound and currmove lines', () => {
    expect(parseInfo('info depth 10 score cp 20 lowerbound pv e2e4', W)).toBeNull();
    expect(parseInfo('info depth 10 currmove e2e4 currmovenumber 1', W)).toBeNull();
  });
  it('parses bestmove', () => {
    expect(parseBestMove('bestmove e2e4 ponder e7e5')).toBe('e2e4');
    expect(parseBestMove('bestmove (none)')).toBeNull();
    expect(parseBestMove('info depth 1')).toBeUndefined();
  });
});
