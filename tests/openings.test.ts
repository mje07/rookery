import { describe, expect, it } from 'vitest';
import { newSrs, review } from '../src/features/openings/sm2';
import { extractCards, leafLines } from '../src/features/openings/repertoire';
import { addMove, createTree, type MoveTree } from '../src/chess/tree';
import { loadBookFromDisk } from './helpers';

function line(t: MoveTree, from: string, moves: string[]) {
  let id = from;
  for (const m of moves) {
    const r = addMove(t, id, m)!;
    t = r.tree;
    id = r.id;
  }
  return { t, id };
}

describe('SM-2', () => {
  it('grows intervals on success and resets on failure', () => {
    const now = 0;
    let s = newSrs(now);
    s = review(s, 5, now);
    expect(s.interval).toBe(1);
    s = review(s, 5, now);
    expect(s.interval).toBe(3);
    s = review(s, 4, now);
    expect(s.interval).toBeGreaterThan(6);
    const failed = review(s, 1, now);
    expect(failed.reps).toBe(0);
    expect(failed.lapses).toBe(1);
    expect(failed.due).toBe(10 * 60 * 1000);
  });
});

describe('repertoire cards', () => {
  it('creates one card per user decision, dedupes transpositions', () => {
    let t = createTree();
    ({ t } = line(t, 'root', ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4']));
    const r = line(t, 'root', ['e4', 'c5', 'Nf3']);
    t = r.t;
    const cards = extractCards({ tree: t, color: 'white' });
    // white decisions: start->e4, after 1...e5 -> Nf3, after 2...Nc6 -> Bc4, after 1...c5 -> Nf3
    expect(cards.map((c) => c.san).sort()).toEqual(['Bc4', 'Nf3', 'Nf3', 'e4']);
    expect(extractCards({ tree: t, color: 'black' }).map((c) => c.san).sort()).toEqual(['Nc6', 'c5', 'e5']);
    expect(leafLines(t)).toHaveLength(2);
  });
});

describe('opening book', () => {
  it('names common openings', () => {
    const book = loadBookFromDisk();
    let t = createTree();
    const r = line(t, 'root', ['e4', 'c6']);
    t = r.t;
    expect(book.nameAt(t.nodes[r.id].fen)?.name).toMatch(/Caro-Kann/);
    expect(book.inBook(t.nodes[r.id].fen)).toBe(true);
  });
});
