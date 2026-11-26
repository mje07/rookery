import { Chess, type Move } from 'chess.js';

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export interface MoveNode {
  id: string;
  parent: string | null;
  /** Ply number of this node (root = 0). */
  ply: number;
  san: string;
  uci: string;
  fen: string;
  children: string[];
  comment?: string;
}

/** A game/analysis as a tree of moves; children[0] is the main line. Plain data, serializable. */
export interface MoveTree {
  rootId: string;
  nodes: Record<string, MoveNode>;
  headers: Record<string, string>;
}

let counter = 0;
const newId = () => `n${Date.now().toString(36)}${(counter++).toString(36)}`;

export function moveToUci(m: Pick<Move, 'from' | 'to' | 'promotion'>): string {
  return m.from + m.to + (m.promotion ?? '');
}

export function createTree(fen = START_FEN, headers: Record<string, string> = {}): MoveTree {
  const id = 'root';
  return {
    rootId: id,
    nodes: { [id]: { id, parent: null, ply: 0, san: '', uci: '', fen, children: [] } },
    headers,
  };
}

/** Play a move (SAN, UCI string, or {from,to,promotion}) from a node; reuses an existing child if present. */
export function addMove(
  tree: MoveTree,
  fromId: string,
  move: string | { from: string; to: string; promotion?: string },
): { tree: MoveTree; id: string } | null {
  const parent = tree.nodes[fromId];
  const chess = new Chess(parent.fen);
  let m: Move;
  try {
    if (typeof move === 'string' && /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move)) {
      m = chess.move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] });
    } else {
      m = chess.move(move);
    }
  } catch {
    return null;
  }
  const uci = moveToUci(m);
  const existing = parent.children.find((c) => tree.nodes[c].uci === uci);
  if (existing) return { tree, id: existing };
  const id = newId();
  const node: MoveNode = { id, parent: fromId, ply: parent.ply + 1, san: m.san, uci, fen: chess.fen(), children: [] };
  return {
    tree: {
      ...tree,
      nodes: { ...tree.nodes, [id]: node, [fromId]: { ...parent, children: [...parent.children, id] } },
    },
    id,
  };
}

/** Node ids from root to the given node (inclusive). */
export function pathTo(tree: MoveTree, id: string): string[] {
  const out: string[] = [];
  let cur: string | null = id;
  while (cur) {
    out.push(cur);
    cur = tree.nodes[cur].parent;
  }
  return out.reverse();
}

/** Main line from root: [root, ...moves]. */
export function mainline(tree: MoveTree, from = tree.rootId): MoveNode[] {
  const out: MoveNode[] = [];
  let cur: MoveNode | undefined = tree.nodes[from];
  while (cur) {
    out.push(cur);
    cur = cur.children[0] ? tree.nodes[cur.children[0]] : undefined;
  }
  return out;
}

export function deleteNode(tree: MoveTree, id: string): MoveTree {
  const node = tree.nodes[id];
  if (!node.parent) return tree;
  const nodes = { ...tree.nodes };
  const stack = [id];
  while (stack.length) {
    const n = stack.pop()!;
    stack.push(...nodes[n].children);
    delete nodes[n];
  }
  const p = nodes[node.parent];
  nodes[node.parent] = { ...p, children: p.children.filter((c) => c !== id) };
  return { ...tree, nodes };
}

export function promoteVariation(tree: MoveTree, id: string): MoveTree {
  const node = tree.nodes[id];
  if (!node.parent) return tree;
  const p = tree.nodes[node.parent];
  return {
    ...tree,
    nodes: { ...tree.nodes, [p.id]: { ...p, children: [id, ...p.children.filter((c) => c !== id)] } },
  };
}

/** Split a (possibly multi-game) PGN file into individual game strings. */
export function splitPgn(text: string): string[] {
  const norm = text.replace(/\r\n?/g, '\n').trim();
  if (!norm) return [];
  const games: string[] = [];
  let cur: string[] = [];
  let seenMoves = false;
  for (const line of norm.split('\n')) {
    const isHeader = /^\s*\[\w+\s+".*"\]\s*$/.test(line);
    if (isHeader && seenMoves) {
      games.push(cur.join('\n').trim());
      cur = [];
      seenMoves = false;
    }
    if (!isHeader && line.trim()) seenMoves = true;
    cur.push(line);
  }
  if (cur.join('').trim()) games.push(cur.join('\n').trim());
  return games;
}

/** Parse one PGN game (main line + comments; variations are dropped by chess.js) into a tree. */
export function treeFromPgn(pgn: string): MoveTree {
  const chess = new Chess();
  chess.loadPgn(pgn);
  const headers = chess.getHeaders() as Record<string, string>;
  const comments = new Map(chess.getComments().map((c) => [c.fen, c.comment]));
  const history = chess.history({ verbose: true });
  const startFen = history[0]?.before ?? chess.fen();
  let tree = createTree(startFen, headers);
  let id = tree.rootId;
  for (const m of history) {
    const r = addMove(tree, id, moveToUci(m))!;
    tree = r.tree;
    id = r.id;
    const c = comments.get(m.after);
    if (c) tree.nodes[id] = { ...tree.nodes[id], comment: c };
  }
  return tree;
}

/** Export the main line as PGN with headers. */
export function treeToPgn(tree: MoveTree): string {
  const root = tree.nodes[tree.rootId];
  const chess = new Chess(root.fen);
  const headers = { ...tree.headers };
  if (root.fen !== START_FEN) {
    headers.SetUp = '1';
    headers.FEN = root.fen;
  }
  for (const [k, v] of Object.entries(headers)) chess.setHeader(k, v);
  for (const n of mainline(tree).slice(1)) chess.move(n.san);
  return chess.pgn();
}

/** Destination map for chessground: square -> legal target squares. */
export function legalDests(fen: string): Map<string, string[]> {
  const chess = new Chess(fen);
  const dests = new Map<string, string[]>();
  for (const m of chess.moves({ verbose: true })) {
    const arr = dests.get(m.from) ?? [];
    if (!arr.includes(m.to)) arr.push(m.to);
    dests.set(m.from, arr);
  }
  return dests;
}

export function turnColor(fen: string): 'white' | 'black' {
  return fen.split(' ')[1] === 'b' ? 'black' : 'white';
}

export function isPromotion(fen: string, from: string, to: string): boolean {
  const chess = new Chess(fen);
  return chess.moves({ verbose: true }).some((m) => m.from === from && m.to === to && !!m.promotion);
}

/** Convert a UCI line to SAN list starting from a FEN; stops at the first illegal move. */
export function uciLineToSan(fen: string, uci: string[]): string[] {
  const chess = new Chess(fen);
  const out: string[] = [];
  for (const u of uci) {
    try {
      out.push(chess.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }).san);
    } catch {
      break;
    }
  }
  return out;
}

/** "12." / "12..." prefix for a move played from the position `beforeFen`. */
export function moveNumberLabel(beforeFen: string): string {
  const [, side, , , , full] = beforeFen.split(' ');
  const n = parseInt(full ?? '1', 10) || 1;
  return side === 'b' ? `${n}...` : `${n}.`;
}

export function isWhiteMove(beforeFen: string): boolean {
  return beforeFen.split(' ')[1] !== 'b';
}
