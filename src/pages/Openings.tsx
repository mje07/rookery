import { useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { Chess } from 'chess.js';
import { Board, arrow } from '../components/Board';
import { MoveList } from '../components/MoveList';
import { db, type RepCard, type Repertoire } from '../db/db';
import { addMove, createTree, pathTo, START_FEN, treeFromPgn, mainline, type MoveTree } from '../chess/tree';
import { loadBook, type OpeningBook } from '../features/openings/book';
import { deleteRepertoire, leafLines, saveRepertoire } from '../features/openings/repertoire';
import { review as srsReview } from '../features/openings/sm2';
import { useTreeNav } from '../lib/useTreeNav';
import { playMoveSound } from '../lib/sound';
import { PageHeader } from '../components/ui';
import { BookMarked, ChevronLeft, ChevronRight, Compass, Trash2 } from 'lucide-react';

export default function Openings() {
  return (
    <div>
      <PageHeader
        title="Openings"
        subtitle="Build the lines you want to play, then drill them. Spaced repetition brings each move back just before you'd forget it."
      />
      <div className="tabs">
        <NavLink to="/openings" end className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}><BookMarked size={15} /> Repertoires</NavLink>
        <NavLink to="/openings/explorer" className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}><Compass size={15} /> Explorer</NavLink>
      </div>
      <Routes>
        <Route index element={<RepertoireList />} />
        <Route path="explorer" element={<Explorer />} />
        <Route path="edit/:id" element={<RepEditor />} />
        <Route path="train/:id/:mode" element={<Trainer />} />
      </Routes>
    </div>
  );
}

function useBook() {
  const [book, setBook] = useState<OpeningBook | null>(null);
  useEffect(() => {
    void loadBook().then(setBook);
  }, []);
  return book;
}

/** Book continuations from a sequence of UCI moves (from the start position). */
function bookNext(book: OpeningBook, path: string[]): { uci: string; count: number }[] {
  const prefix = path.join(' ');
  const counts = new Map<string, number>();
  for (const [, , moves] of book.lines) {
    if (prefix && !moves.startsWith(prefix + ' ')) continue;
    const rest = prefix ? moves.slice(prefix.length + 1) : moves;
    const next = rest.split(' ')[0];
    if (next) counts.set(next, (counts.get(next) ?? 0) + 1);
  }
  return [...counts.entries()].map(([uci, count]) => ({ uci, count })).sort((a, b) => b.count - a.count);
}

function sanOf(fen: string, uci: string) {
  try {
    return new Chess(fen).move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san;
  } catch {
    return uci;
  }
}

/* ------------------------------------------------------------------ list */

function RepertoireList() {
  const navigate = useNavigate();
  const [reps, setReps] = useState<(Repertoire & { due: number; total: number })[]>([]);
  const [name, setName] = useState('');
  const [color, setColor] = useState<'white' | 'black'>('white');

  const refresh = useCallback(async () => {
    const all = await db.repertoires.toArray();
    const now = Date.now();
    setReps(
      await Promise.all(
        all.map(async (r) => {
          const cards = await db.repCards.where('repertoireId').equals(r.id!).toArray();
          return { ...r, total: cards.length, due: cards.filter((c) => c.due <= now).length };
        }),
      ),
    );
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = async () => {
    const id = await saveRepertoire({ name: name.trim() || `My ${color} repertoire`, color, tree: createTree(), createdAt: Date.now() });
    navigate(`/openings/edit/${id}`);
  };

  return (
    <div style={{ maxWidth: 900 }}>
      <div className="grid">
        {reps.map((r) => (
          <div key={r.id} className="card">
            <div className="stat-row">
              <span className={`avatar ${r.color}`} style={{ marginBottom: 12 }}>{r.color === 'white' ? '♔' : '♚'}</span>
              <span className="btn-row" style={{ gap: 4 }}>
                {r.due > 0 && <span className="tag accent">{r.due} due</span>}
                <button
                  className="btn small ghost"
                  title="Delete repertoire"
                  aria-label="Delete repertoire"
                  onClick={async () => {
                    if (confirm(`Delete "${r.name}"?`)) {
                      await deleteRepertoire(r.id!);
                      void refresh();
                    }
                  }}
                >
                  <Trash2 size={15} />
                </button>
              </span>
            </div>
            <div className="card-title">{r.name}</div>
            <div className="muted small" style={{ margin: '4px 0 10px' }}>
              {r.total} moves to know · <b style={{ color: r.due ? 'var(--accent)' : undefined }}>{r.due} due</b>
            </div>
            <div className="btn-row">
              <button className="btn small primary" disabled={!r.due} onClick={() => navigate(`/openings/train/${r.id}/due`)}>Review due</button>
              <button className="btn small" disabled={!r.total} onClick={() => navigate(`/openings/train/${r.id}/drill`)}>Drill lines</button>
              <button className="btn small" onClick={() => navigate(`/openings/edit/${r.id}`)}>Edit</button>
            </div>
          </div>
        ))}
      </div>
      <div className="panel" style={{ marginTop: 16, display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <label className="field" style={{ flex: 1, minWidth: 200 }}>
          New repertoire
          <input type="text" value={name} placeholder="e.g. Italian Game" onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field" style={{ width: 140 }}>
          Color
          <select value={color} onChange={(e) => setColor(e.target.value as 'white' | 'black')}>
            <option value="white">White</option>
            <option value="black">Black</option>
          </select>
        </label>
        <button className="btn primary" onClick={() => void create()}>Create</button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ explorer */

function Explorer() {
  const book = useBook();
  const [path, setPath] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const fens = useMemo(() => {
    const c = new Chess();
    const out = [c.fen()];
    for (const u of path) {
      c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
      out.push(c.fen());
    }
    return out;
  }, [path]);
  const fen = fens[fens.length - 1];
  const next = useMemo(() => (book ? bookNext(book, path) : []), [book, path]);
  let name: string | undefined;
  if (book) for (const f of fens) name = book.nameAt(f)?.name ?? name;
  const results = useMemo(() => {
    if (!book || query.trim().length < 3) return [];
    const q = query.toLowerCase();
    const seen = new Set<string>();
    return book.lines
      .filter(([, n]) => n.toLowerCase().includes(q) && !seen.has(n) && seen.add(n))
      .slice(0, 30);
  }, [book, query]);

  if (!book) return <div className="page-loading">Loading opening book…</div>;
  return (
    <div className="board-layout">
      <Board
        fen={fen}
        movable="both"
        lastMove={path[path.length - 1]}
        onMove={(u) => setPath([...path, u])}
        shapes={next.slice(0, 4).map((n, i) => arrow(n.uci, i === 0 ? 'green' : 'blue', i === 0 ? 10 : 6))}
      />
      <div className="side-col">
        <div className="panel">
          <h2 style={{ marginBottom: 4 }}>{name ?? 'Starting position'}</h2>
          <div className="muted small">{path.length ? path.map((u, i) => sanOf(fens[i], u)).join(' ') : 'Play a move or pick one below.'}</div>
          <div className="btn-row" style={{ marginTop: 8 }}>
            <button className="btn small" onClick={() => setPath(path.slice(0, -1))} disabled={!path.length}>◀ Back</button>
            <button className="btn small" onClick={() => setPath([])}>Reset</button>
          </div>
        </div>
        <div className="panel">
          <h3>Book moves</h3>
          {next.length ? (
            <div className="tree-list">
              {next.map((n) => {
                const after = new Chess(fen);
                after.move({ from: n.uci.slice(0, 2), to: n.uci.slice(2, 4), promotion: n.uci[4] });
                const nm = book.nameAt(after.fen());
                return (
                  <div key={n.uci} className="tree-item" onClick={() => setPath([...path, n.uci])}>
                    <b>{sanOf(fen, n.uci)}</b>
                    <span className="muted small" style={{ flex: 1, textAlign: 'right' }}>{nm?.name ?? ''}</span>
                    <span className="tag">{n.count}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="muted small">Out of book. No named lines continue from here.</div>
          )}
        </div>
        <div className="panel">
          <input type="text" placeholder="Search openings (e.g. Caro-Kann)" value={query} onChange={(e) => setQuery(e.target.value)} />
          <div className="tree-list" style={{ marginTop: 8 }}>
            {results.map(([eco, n, moves]) => (
              <div key={n} className="tree-item" onClick={() => setPath(moves.split(' '))}>
                <span>{n}</span>
                <span className="tag">{eco}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ editor */

function RepEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const book = useBook();
  const [rep, setRep] = useState<Repertoire | null>(null);
  const nav = useTreeNav();
  const { tree, node, currentId, setCurrentId, play, reset } = nav;
  const [dirty, setDirty] = useState(false);
  const [pgn, setPgn] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    void db.repertoires.get(Number(id)).then((r) => {
      if (!r) return;
      setRep(r);
      reset(r.tree);
    });
  }, [id, reset]);

  const path = useMemo(() => pathTo(tree, currentId).slice(1).map((n) => tree.nodes[n].uci), [tree, currentId]);
  const suggestions = useMemo(() => (book ? bookNext(book, path).slice(0, 8) : []), [book, path]);
  const name = useMemo(() => {
    if (!book) return undefined;
    let n: string | undefined;
    for (const nid of pathTo(tree, currentId)) n = book.nameAt(tree.nodes[nid].fen)?.name ?? n;
    return n;
  }, [book, tree, currentId]);

  if (!rep) return <div className="page-loading">Loading…</div>;
  const userTurn = node.fen.split(' ')[1] === rep.color[0];

  const onMove = (u: string) => {
    if (play(u)) setDirty(true);
  };
  const save = async () => {
    await saveRepertoire({ ...rep, tree });
    setDirty(false);
    setMsg('Saved.');
    setTimeout(() => setMsg(''), 1500);
  };
  const importPgn = () => {
    try {
      const line = mainline(treeFromPgn(pgn)).slice(1);
      let t: MoveTree = tree;
      let cur = t.rootId;
      if (t.nodes[t.rootId].fen !== START_FEN) throw new Error('Repertoires start from the initial position.');
      for (const n of line) {
        const r = addMove(t, cur, n.uci);
        if (!r) break;
        t = r.tree;
        cur = r.id;
      }
      nav.setTree(t);
      setCurrentId(cur);
      setDirty(true);
      setPgn('');
    } catch (e) {
      setMsg(`Import failed: ${(e as Error).message}`);
    }
  };

  return (
    <div className="board-layout">
      <Board fen={node.fen} orientation={rep.color} movable="both" onMove={onMove} lastMove={node.uci} />
      <div className="side-col">
        <div className="panel">
          <h2 style={{ marginBottom: 2 }}>{rep.name}</h2>
          <div className="muted small">
            Playing {rep.color}. {name ? `· ${name}` : ''}
          </div>
          <div className="muted small" style={{ marginTop: 6 }}>
            {userTurn
              ? 'Your move: play the move you want to learn here.'
              : 'Opponent to move: add each reply you want to be ready for.'}
          </div>
        </div>
        {suggestions.length > 0 && (
          <div className="panel">
            <h3>Book moves here</h3>
            <div className="btn-row">
              {suggestions.map((s) => (
                <button key={s.uci} className="btn small" onClick={() => onMove(s.uci)} title={`${s.count} named lines`}>
                  {sanOf(node.fen, s.uci)}
                </button>
              ))}
            </div>
          </div>
        )}
        <MoveList
          tree={tree}
          currentId={currentId}
          onSelect={setCurrentId}
          onContext={(nid) => {
            if (confirm('Delete this move and everything after it?')) {
              const parent = tree.nodes[nid].parent!;
              nav.setTree((t) => {
                const nodes = { ...t.nodes };
                const stack = [nid];
                while (stack.length) {
                  const k = stack.pop()!;
                  stack.push(...nodes[k].children);
                  delete nodes[k];
                }
                nodes[parent] = { ...nodes[parent], children: nodes[parent].children.filter((c) => c !== nid) };
                return { ...t, nodes };
              });
              setCurrentId(parent);
              setDirty(true);
            }
          }}
        />
        <div className="btn-row">
          <button className="btn" onClick={nav.back} aria-label="Previous"><ChevronLeft size={17} /></button>
          <button className="btn" onClick={nav.forward} aria-label="Next"><ChevronRight size={17} /></button>
          <button className="btn primary" onClick={() => void save()} disabled={!dirty}>Save</button>
          <button className="btn" onClick={() => navigate('/openings')}>Done</button>
          {msg && <span className="muted small">{msg}</span>}
        </div>
        <div className="panel">
          <h3>Add a line from PGN</h3>
          <textarea rows={3} value={pgn} onChange={(e) => setPgn(e.target.value)} placeholder="1. e4 e5 2. Nf3 Nc6 3. Bc4" />
          <button className="btn small" style={{ marginTop: 6 }} onClick={importPgn} disabled={!pgn.trim()}>Add line</button>
          <div className="muted small" style={{ marginTop: 6 }}>Right-click a move to delete it.</div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ trainer */

interface Task {
  card: RepCard;
  fen: string;
  lastUci?: string;
}

function Trainer() {
  const { id, mode } = useParams();
  const navigate = useNavigate();
  const [rep, setRep] = useState<Repertoire | null>(null);
  const [queue, setQueue] = useState<Task[]>([]);
  const [i, setI] = useState(0);
  const [status, setStatus] = useState<'ask' | 'wrong' | 'right' | 'done'>('ask');
  const [mistakes, setMistakes] = useState(0);
  const [score, setScore] = useState({ right: 0, wrong: 0 });
  const [shown, setShown] = useState<{ fen: string; lastUci?: string } | null>(null);

  const build = useCallback(async () => {
    const r = await db.repertoires.get(Number(id));
    if (!r) return;
    setRep(r);
    const cards = await db.repCards.where('repertoireId').equals(r.id!).toArray();
    let tasks: Task[];
    if (mode === 'due') {
      const now = Date.now();
      tasks = cards.filter((c) => c.due <= now).sort((a, b) => a.due - b.due).slice(0, 30).map((c) => ({ card: c, fen: c.fen, lastUci: c.lastUci }));
    } else {
      // Drill a random full line: the user's moves along it, in order.
      const lines = leafLines(r.tree).filter((l) => l.length > 1);
      const line = lines[Math.floor(Math.random() * lines.length)] ?? [];
      const byKey = new Map(cards.map((c) => [`${c.key}|${c.uci}`, c]));
      tasks = [];
      for (let k = 0; k < line.length - 1; k++) {
        const n = r.tree.nodes[line[k]];
        const child = r.tree.nodes[line[k + 1]];
        if (n.fen.split(' ')[1] !== r.color[0]) continue;
        const card = byKey.get(`${n.fen.split(' ').slice(0, 4).join(' ')}|${child.uci}`);
        if (card) tasks.push({ card, fen: n.fen, lastUci: n.uci || undefined });
      }
    }
    setQueue(tasks);
    setI(0);
    setStatus(tasks.length ? 'ask' : 'done');
    setMistakes(0);
    setScore({ right: 0, wrong: 0 });
    setShown(null);
  }, [id, mode]);

  useEffect(() => {
    void build();
  }, [build]);

  const task = queue[i];
  if (!rep || (!task && status !== 'done')) return <div className="page-loading">Loading…</div>;

  const grade = async (g: number) => {
    const c = task.card;
    const s = srsReview(c, g);
    await db.repCards.update(c.id!, s);
  };

  const advance = () => {
    setShown(null);
    setMistakes(0);
    if (i + 1 >= queue.length) setStatus('done');
    else {
      setI(i + 1);
      setStatus('ask');
    }
  };

  const onMove = async (u: string) => {
    if (status !== 'ask') return;
    // Any of the repertoire's moves in this position is accepted (a position can have several).
    const allowed = await db.repCards.where('repertoireId').equals(rep.id!).filter((c) => c.key === task.card.key).toArray();
    const ok = allowed.some((c) => c.uci === u);
    const after = new Chess(task.fen);
    after.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
    setShown({ fen: after.fen(), lastUci: u });
    if (ok) {
      playMoveSound('success');
      setStatus('right');
      setScore((s) => ({ ...s, right: s.right + 1 }));
      const card = allowed.find((c) => c.uci === u)!;
      await db.repCards.update(card.id!, srsReview(card, mistakes ? 3 : 5));
      setTimeout(advance, 700);
    } else {
      playMoveSound('fail');
      setStatus('wrong');
      setMistakes((m) => m + 1);
      if (!mistakes) {
        setScore((s) => ({ ...s, wrong: s.wrong + 1 }));
        await grade(1);
      }
      setTimeout(() => {
        setShown(null);
        setStatus('ask');
      }, 900);
    }
  };

  if (status === 'done') {
    return (
      <div className="panel" style={{ maxWidth: 520 }}>
        <h1>{queue.length ? 'Session complete' : 'Nothing to review'}</h1>
        {queue.length > 0 && (
          <p>
            <span className="check">{score.right}</span> right on first try · <span className="error">{score.wrong}</span> missed
          </p>
        )}
        <div className="btn-row">
          {mode === 'drill' && <button className="btn primary" onClick={() => void build()}>Another line</button>}
          <button className="btn" onClick={() => navigate('/openings')}>Back to repertoires</button>
        </div>
      </div>
    );
  }

  const fen = shown?.fen ?? task.fen;
  const hintShapes = mistakes >= 2 ? [arrow(task.card.uci, 'green')] : [];
  return (
    <div className="board-layout">
      <Board fen={fen} orientation={rep.color} movable={status === 'ask' ? rep.color : undefined} onMove={(u) => void onMove(u)} lastMove={shown?.lastUci ?? task.lastUci} shapes={hintShapes} />
      <div className="side-col">
        <div className="panel">
          <h2 style={{ marginBottom: 2 }}>{rep.name}</h2>
          <div className="muted small">{mode === 'due' ? 'Due review' : 'Line drill'} · {i + 1} / {queue.length}</div>
          <div className="progress" style={{ marginTop: 8 }}>
            <div style={{ width: `${(i / queue.length) * 100}%` }} />
          </div>
        </div>
        <div className={`feedback ${status === 'right' ? 'ok' : status === 'wrong' ? 'bad' : 'info'}`}>
          {status === 'right' ? 'Correct!' : status === 'wrong' ? 'That’s not your repertoire move.' : 'What do you play here?'}
        </div>
        {mistakes >= 1 && status === 'ask' && (
          <button className="btn small" onClick={() => setMistakes(2)}>Show the move</button>
        )}
      </div>
    </div>
  );
}
