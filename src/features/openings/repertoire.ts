import { db, type RepCard, type Repertoire } from '../../db/db';
import type { MoveTree } from '../../chess/tree';
import { epd } from './book';
import { newSrs } from './sm2';

/** The positions in a repertoire where the user must answer, and the move(s) they chose. */
export function extractCards(rep: Pick<Repertoire, 'tree' | 'color'>): { key: string; fen: string; uci: string; san: string; lastUci: string }[] {
  const side = rep.color === 'white' ? 'w' : 'b';
  const out: { key: string; fen: string; uci: string; san: string; lastUci: string }[] = [];
  const seen = new Set<string>();
  for (const node of Object.values(rep.tree.nodes)) {
    if (node.fen.split(' ')[1] !== side) continue;
    for (const c of node.children) {
      const child = rep.tree.nodes[c];
      const key = epd(node.fen);
      const id = `${key}|${child.uci}`;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({ key, fen: node.fen, uci: child.uci, san: child.san, lastUci: node.uci });
    }
  }
  return out;
}

/** Save a repertoire and sync its cards, preserving learning progress for unchanged moves. */
export async function saveRepertoire(rep: Repertoire): Promise<number> {
  return db.transaction('rw', db.repertoires, db.repCards, async () => {
    const id = (await db.repertoires.put(rep)) as number;
    const existing = await db.repCards.where('repertoireId').equals(id).toArray();
    const byId = new Map(existing.map((c) => [`${c.key}|${c.uci}`, c]));
    const wanted = extractCards(rep);
    const keep = new Set<string>();
    const now = Date.now();
    for (const w of wanted) {
      const k = `${w.key}|${w.uci}`;
      keep.add(k);
      const old = byId.get(k);
      if (old) await db.repCards.update(old.id!, { fen: w.fen, san: w.san, lastUci: w.lastUci } as Partial<RepCard>);
      else await db.repCards.add({ repertoireId: id, ...w, ...newSrs(now) } as RepCard);
    }
    for (const c of existing) if (!keep.has(`${c.key}|${c.uci}`)) await db.repCards.delete(c.id!);
    return id;
  });
}

export async function deleteRepertoire(id: number) {
  await db.transaction('rw', db.repertoires, db.repCards, async () => {
    await db.repertoires.delete(id);
    await db.repCards.where('repertoireId').equals(id).delete();
  });
}

/** All root-to-leaf lines (node id paths) in a tree. */
export function leafLines(tree: MoveTree): string[][] {
  const out: string[][] = [];
  const walk = (id: string, path: string[]) => {
    const n = tree.nodes[id];
    const p = [...path, id];
    if (!n.children.length) out.push(p);
    for (const c of n.children) walk(c, p);
  };
  walk(tree.rootId, []);
  return out;
}
