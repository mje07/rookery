import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Chess } from 'chess.js';
import { Board, arrow } from '../components/Board';
import { EvalBar } from '../components/EvalBar';
import { MoveList } from '../components/MoveList';
import { EngineLines } from '../components/EngineLines';
import { useTreeNav } from '../lib/useTreeNav';
import { useLiveEngine } from '../lib/useLiveEngine';
import { addMove, createTree, deleteNode, promoteVariation, START_FEN, treeFromPgn, treeToPgn, type MoveTree } from '../chess/tree';
import { loadBook, type OpeningName } from '../features/openings/book';
import { NavBar } from '../components/ui';
import { Copy, FilePlus2, Siren } from 'lucide-react';
import { analysisEngine } from '../engine/EngineService';
import { uciLineToSan } from '../chess/tree';

/** The same position with the other side to move: "what would they play if it were their turn?" */
function threatFen(fen: string): string | null {
  const c = new Chess(fen);
  if (c.inCheck() || c.isGameOver()) return null;
  const parts = fen.split(' ');
  parts[1] = parts[1] === 'w' ? 'b' : 'w';
  parts[3] = '-';
  try {
    return new Chess(parts.join(' ')).fen();
  } catch {
    return null;
  }
}

/** Free analysis board: play moves, branch variations, live engine, PGN/FEN import & export. */
export default function Analysis() {
  const location = useLocation();
  const initial = (location.state as { fen?: string; pgn?: string } | null) ?? null;
  const nav = useTreeNav(useMemo(() => initialTree(initial), [initial]));
  const { tree, node, currentId, setCurrentId, play, reset, setTree } = nav;
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  const [engineOn, setEngineOn] = useState(true);
  const [importText, setImportText] = useState('');
  const [error, setError] = useState('');
  const [opening, setOpening] = useState<OpeningName | undefined>();
  const [lineCount, setLineCount] = useState(3);
  const [threatOn, setThreatOn] = useState(false);
  const tFen = useMemo(() => (threatOn ? threatFen(node.fen) : null), [threatOn, node.fen]);
  const analysedFen = tFen ?? node.fen;
  const result = useLiveEngine(analysedFen, engineOn, tFen ? 1 : lineCount);

  // X toggles threat mode (as on most analysis boards).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return;
      if (e.key === 'x' || e.key === 'X') setThreatOn((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    let alive = true;
    void loadBook().then((b) => {
      if (!alive) return;
      // deepest named position on the path to the current node
      let id: string | null = currentId;
      while (id) {
        const n = b.nameAt(tree.nodes[id].fen);
        if (n) return setOpening(n);
        id = tree.nodes[id].parent;
      }
      setOpening(undefined);
    });
    return () => {
      alive = false;
    };
  }, [currentId, tree]);

  // Arrows for every engine line: best is bold green, alternatives thinner blue; threats are red.
  const arrowKey = result?.lines.map((l) => l.pv[0]).join(',') ?? '';
  const shapes = useMemo(() => {
    if (!engineOn || !arrowKey) return [];
    const moves = arrowKey.split(',');
    if (tFen) return [arrow(moves[0], 'red', 11)];
    return moves.map((m, i) => arrow(m, i === 0 ? 'green' : 'blue', i === 0 ? 11 : Math.max(4, 9 - i * 2)));
  }, [engineOn, arrowKey, tFen]);
  const threatLine = tFen && result?.lines[0] ? uciLineToSan(tFen, result.lines[0].pv.slice(0, 4)) : [];
  const info = analysisEngine().getInfo();
  const status = result
    ? [
        `depth ${result.depth}`,
        result.nps ? `${result.nps >= 1e6 ? (result.nps / 1e6).toFixed(1) + ' Mn/s' : Math.round(result.nps / 1000) + ' kn/s'}` : '',
        info ? `${info.threads} thread${info.threads > 1 ? 's' : ''}${info.flavor === 'strong' ? ' · strong' : ''}` : '',
      ].filter(Boolean).join(' · ')
    : '';

  const doImport = () => {
    setError('');
    const text = importText.trim();
    if (!text) return;
    try {
      if (/^[rnbqkpRNBQKP1-8/]+ [wb] /.test(text)) {
        new Chess(text); // validates
        reset(createTree(text));
      } else {
        reset(treeFromPgn(text));
      }
      setImportText('');
    } catch (e) {
      setError(`Couldn't read that: ${(e as Error).message}`);
    }
  };

  const playLine = (ucis: string[]) => {
    let t: MoveTree = tree;
    let id = currentId;
    for (const u of ucis) {
      const r = addMove(t, id, u);
      if (!r) break;
      t = r.tree;
      id = r.id;
    }
    setTree(t);
    setCurrentId(id);
  };

  return (
    <div className="board-layout">
      <div className="board-col">
        <EvalBar score={engineOn && !tFen ? result?.lines[0]?.score : undefined} orientation={orientation} />
        <Board fen={node.fen} orientation={orientation} movable="both" onMove={play} lastMove={node.uci} shapes={shapes} />
      </div>
      <div className="side-col">
        <div className="panel">
          <div className="btn-row" style={{ justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0 }}>Analysis board</h2>
            <label className="btn-row small muted">
              <input type="checkbox" checked={engineOn} onChange={(e) => setEngineOn(e.target.checked)} /> Engine
            </label>
          </div>
          {opening && (
            <div style={{ marginTop: 8 }}>
              <span className="tag accent">{opening.eco} · {opening.name}</span>
            </div>
          )}
          {engineOn && (
            <>
              <div className="btn-row" style={{ marginTop: 10, justifyContent: 'space-between' }}>
                <div className="tabs" style={{ margin: 0, padding: 3 }} aria-label="Number of engine lines">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} className={`tab ${lineCount === n ? 'active' : ''}`} style={{ padding: '3px 9px' }} onClick={() => setLineCount(n)} disabled={!!tFen}>
                      {n}
                    </button>
                  ))}
                </div>
                <button
                  className={`btn small ${threatOn ? 'primary' : ''}`}
                  onClick={() => setThreatOn((v) => !v)}
                  title="Show what your opponent threatens if it were their move (X)"
                  disabled={threatOn ? false : !threatFen(node.fen)}
                >
                  <Siren size={15} /> Threat
                </button>
              </div>
              <div style={{ marginTop: 10 }}>
                {tFen ? (
                  <div className="feedback bad" style={{ fontWeight: 500 }}>
                    <Siren size={18} />
                    <div>
                      <b>Threat:</b> {threatLine.length ? threatLine.join(' ') : 'thinking…'}
                      <div className="small" style={{ opacity: 0.85, marginTop: 2 }}>
                        What {node.fen.split(' ')[1] === 'w' ? 'Black' : 'White'} would play if it were their move. Press X to turn off.
                      </div>
                    </div>
                  </div>
                ) : (
                  <EngineLines fen={node.fen} result={result} onPlayLine={playLine} />
                )}
              </div>
              {status && <div className="muted small" style={{ marginTop: 8 }}>{status}</div>}
            </>
          )}
        </div>
        <MoveList
          tree={tree}
          currentId={currentId}
          onSelect={setCurrentId}
          onContext={(id) => {
            const choice = window.prompt('Type "d" to delete from here, "p" to promote this variation');
            if (choice === 'd') {
              const parent = tree.nodes[id].parent!;
              setTree(deleteNode(tree, id));
              setCurrentId(parent);
            } else if (choice === 'p') setTree(promoteVariation(tree, id));
          }}
        />
        <NavBar
          onFirst={nav.first}
          onPrev={nav.back}
          onNext={nav.forward}
          onLast={nav.last}
          onFlip={() => setOrientation((o) => (o === 'white' ? 'black' : 'white'))}
        >
          <button className="icon-btn" title="New board" onClick={() => reset(createTree())}><FilePlus2 size={18} /></button>
        </NavBar>
        <div className="panel">
          <h3>Import / export</h3>
          <textarea rows={4} placeholder="Paste a PGN or FEN" value={importText} onChange={(e) => setImportText(e.target.value)} />
          {error && <div className="error small">{error}</div>}
          <div className="btn-row" style={{ marginTop: 8 }}>
            <button className="btn primary" onClick={doImport}>Load</button>
            <button className="btn" onClick={() => void navigator.clipboard.writeText(node.fen)}><Copy size={15} /> FEN</button>
            <button className="btn" onClick={() => void navigator.clipboard.writeText(treeToPgn(tree))}><Copy size={15} /> PGN</button>
          </div>
          <div className="muted small" style={{ marginTop: 8, wordBreak: 'break-all' }}>{node.fen}</div>
          <div className="muted small" style={{ marginTop: 4 }}>Right-click a move to delete or promote it. ←/→ to navigate.</div>
        </div>
      </div>
    </div>
  );
}

function initialTree(init: { fen?: string; pgn?: string } | null): MoveTree {
  try {
    if (init?.pgn) return treeFromPgn(init.pgn);
    if (init?.fen) return createTree(init.fen);
  } catch {
    /* fall through */
  }
  return createTree(START_FEN);
}
