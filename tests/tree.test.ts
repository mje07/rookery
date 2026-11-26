import { describe, expect, it } from 'vitest';
import {
  addMove,
  createTree,
  deleteNode,
  mainline,
  moveNumberLabel,
  promoteVariation,
  splitPgn,
  treeFromPgn,
  treeToPgn,
  uciLineToSan,
} from '../src/chess/tree';
import { OPERA_GAME } from './helpers';

describe('move tree', () => {
  it('parses PGN into a main line', () => {
    const t = treeFromPgn(OPERA_GAME);
    const line = mainline(t);
    expect(line.length).toBe(34); // root + 33 plies
    expect(line[line.length - 1].san).toBe('Rd8#');
    expect(t.headers.White).toBe('Paul Morphy');
  });
  it('round-trips PGN', () => {
    const t = treeFromPgn(OPERA_GAME);
    const again = treeFromPgn(treeToPgn(t));
    expect(mainline(again).map((n) => n.san)).toEqual(mainline(t).map((n) => n.san));
  });
  it('branches, reuses existing children, deletes and promotes', () => {
    let t = createTree();
    const a = addMove(t, t.rootId, 'e2e4')!;
    t = a.tree;
    const b = addMove(t, t.rootId, 'd4')!;
    t = b.tree;
    expect(addMove(t, t.rootId, 'e4')!.id).toBe(a.id);
    expect(t.nodes[t.rootId].children).toEqual([a.id, b.id]);
    t = promoteVariation(t, b.id);
    expect(mainline(t)[1].san).toBe('d4');
    t = deleteNode(t, b.id);
    expect(t.nodes[b.id]).toBeUndefined();
    expect(t.nodes[t.rootId].children).toEqual([a.id]);
    expect(addMove(t, t.rootId, 'e2e5')).toBeNull();
  });
  it('splits multi-game PGN files', () => {
    expect(splitPgn(`${OPERA_GAME}\n\n${OPERA_GAME}`)).toHaveLength(2);
    expect(splitPgn('1. e4 e5')).toHaveLength(1);
  });
  it('labels move numbers from the FEN', () => {
    expect(moveNumberLabel('8/8/8/8/8/8/8/K6k b - - 0 12')).toBe('12...');
    expect(moveNumberLabel(createTree().nodes.root.fen)).toBe('1.');
  });
  it('converts UCI lines to SAN', () => {
    expect(uciLineToSan(createTree().nodes.root.fen, ['e2e4', 'e7e5', 'g1f3', 'zzzz'])).toEqual(['e4', 'e5', 'Nf3']);
  });
});
