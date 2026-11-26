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
  const result = useLiveEngine(node.fen, engineOn);

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

  const bestArrow = result?.lines[0]?.pv[0];
  const shapes = useMemo(() => (engineOn && bestArrow ? [arrow(bestArrow, 'blue')] : []), [engineOn, bestArrow]);

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
        <EvalBar score={engineOn ? result?.lines[0]?.score : undefined} orientation={orientation} />
        <Board fen={node.fen} orientation={orientation} movable="both" onMove={play} lastMove={node.uci} shapes={shapes} />
      </div>
      <div className="side-col">
        <div className="panel">
          <div className="btn-row" style={{ justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0 }}>Analysis</h2>
            <label className="btn-row small">
              <input type="checkbox" checked={engineOn} onChange={(e) => setEngineOn(e.target.checked)} /> Engine
            </label>
          </div>
          {opening && (
            <div className="muted small" style={{ marginTop: 6 }}>
              {opening.eco} · {opening.name}
            </div>
          )}
          {engineOn && (
            <div style={{ marginTop: 10 }}>
              <EngineLines fen={node.fen} result={result} onPlayLine={playLine} />
            </div>
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
        <div className="btn-row">
          <button className="btn" onClick={nav.first}>⏮</button>
          <button className="btn" onClick={nav.back}>◀</button>
          <button className="btn" onClick={nav.forward}>▶</button>
          <button className="btn" onClick={nav.last}>⏭</button>
          <button className="btn" onClick={() => setOrientation((o) => (o === 'white' ? 'black' : 'white'))}>Flip</button>
          <button className="btn" onClick={() => reset(createTree())}>New</button>
        </div>
        <div className="panel">
          <h3>Import / export</h3>
          <textarea rows={4} placeholder="Paste a PGN or FEN" value={importText} onChange={(e) => setImportText(e.target.value)} />
          {error && <div className="error small">{error}</div>}
          <div className="btn-row" style={{ marginTop: 8 }}>
            <button className="btn primary" onClick={doImport}>Load</button>
            <button className="btn" onClick={() => void navigator.clipboard.writeText(node.fen)}>Copy FEN</button>
            <button className="btn" onClick={() => void navigator.clipboard.writeText(treeToPgn(tree))}>Copy PGN</button>
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
