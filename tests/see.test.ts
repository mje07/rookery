import { describe, expect, it } from 'vitest';
import { see } from '../src/chess/see';
import { isSacrifice } from '../src/features/review/classify';

describe('static exchange evaluation', () => {
  it('free piece: wins its full value', () => {
    expect(see('4k3/8/8/3n4/8/8/8/3RK3 w - - 0 1', 'd5', 'w')).toBe(3);
  });
  it('even trade: rook takes rook defended by a pawn', () => {
    expect(see('4k3/8/4p3/3r4/8/8/8/3RK3 w - - 0 1', 'd5', 'w')).toBe(0);
  });
  it('losing capture: knight takes a pawn defended by a pawn', () => {
    expect(see('4k3/8/4p3/3p4/8/2N5/8/4K3 w - - 0 1', 'd5', 'w')).toBe(-2);
  });
  it('multi-step exchange: N and Q vs a knight-defended pawn', () => {
    // 1.Nxd5 Nxd5 2.Qxd5 nets a pawn
    expect(see('4k3/8/5n2/3p4/8/2N5/8/3QK3 w - - 0 1', 'd5', 'w')).toBe(1);
  });
  it('x-ray: doubled rooks win a rook-defended pawn', () => {
    expect(see('3rk3/8/8/3p4/8/8/3R4/3RK3 w - - 0 1', 'd5', 'w')).toBe(1);
  });
  it('a defended piece attacked only by the king cannot be taken', () => {
    expect(see('8/8/8/8/8/2b5/1p6/K6k w - - 0 1', 'b2', 'w')).toBe(0);
  });
  it('nothing to capture', () => {
    expect(see('4k3/8/8/8/8/8/8/3RK3 w - - 0 1', 'd5', 'w')).toBe(0);
  });
});

describe('sacrifice detection uses exchanges', () => {
  it('a bishop given for a pawn (Bxf7+ Kxf7) is a sacrifice', () => {
    const fen = 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';
    expect(isSacrifice(fen, 'c4f7')).toBe(true); // Bxf7+ Kxf7: bishop for a pawn
  });
  it('a properly defended trade is not a sacrifice', () => {
    const fen = 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
    expect(isSacrifice(fen, 'e4d5')).toBe(false);
  });
});
