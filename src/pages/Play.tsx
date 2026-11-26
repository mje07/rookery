import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Chess } from 'chess.js';
import { Board, arrow } from '../components/Board';
import { MoveList } from '../components/MoveList';
import { botEngine, analysisEngine } from '../engine/EngineService';
import { addMove, createTree, mainline, treeToPgn, type MoveTree } from '../chess/tree';
import { BOTS, botMove, TIME_CONTROLS, type Bot, type TimeControl } from '../features/play/bots';
import { saveGame } from '../features/review/gameLibrary';
import { playMoveSound } from '../lib/sound';
import { PageHeader, PlayerStrip } from '../components/ui';
import { Flag, Handshake, Lightbulb, Swords, Undo2 } from 'lucide-react';

type Side = 'white' | 'black';
interface Setup {
  nonce: number;
  bot: Bot;
  color: Side;
  tc: TimeControl;
}

export default function Play() {
  const [setup, setSetup] = useState<Setup | null>(null);
  return setup ? <Game key={setup.nonce} setup={setup} onExit={() => setSetup(null)} /> : <Lobby onStart={setSetup} />;
}

function Lobby({ onStart }: { onStart: (s: Setup) => void }) {
  const [bot, setBot] = useState(BOTS[3]);
  const [color, setColor] = useState<'white' | 'black' | 'random'>('white');
  const [tc, setTc] = useState(TIME_CONTROLS[0]);
  return (
    <div style={{ maxWidth: 980 }}>
      <PageHeader title="Play a bot" subtitle="Pick an opponent. When the game ends you can send it straight to Game Review." />
      <div className="grid">
        {BOTS.map((b) => (
          <button
            key={b.id}
            className={`card ${b.id === bot.id ? 'selected' : ''}`}
            style={{ textAlign: 'left', cursor: 'pointer' }}
            onClick={() => setBot(b)}
          >
            <div className="bot-avatar">{b.avatar}</div>
            <div className="card-title btn-row" style={{ justifyContent: 'space-between' }}>
              {b.name} <span className={`tag ${b.id === bot.id ? 'accent' : ''}`}>{b.id === 'apex' ? 'max' : `~${b.rating}`}</span>
            </div>
            <div className="muted small">{b.blurb}</div>
          </button>
        ))}
      </div>
      <div className="panel" style={{ marginTop: 18, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end', position: 'sticky', bottom: 16 }}>
        <label className="field" style={{ width: 200 }}>
          You play
          <select value={color} onChange={(e) => setColor(e.target.value as typeof color)}>
            <option value="white">White</option>
            <option value="black">Black</option>
            <option value="random">Random</option>
          </select>
        </label>
        <label className="field" style={{ width: 200 }}>
          Clock
          <select value={tc.id} onChange={(e) => setTc(TIME_CONTROLS.find((t) => t.id === e.target.value)!)}>
            {TIME_CONTROLS.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </label>
        <button
          className="btn primary"
          onClick={() => onStart({ nonce: Date.now(), bot, tc, color: color === 'random' ? (Math.random() < 0.5 ? 'white' : 'black') : color })}
        >
          <Swords size={17} /> Play {bot.name}
        </button>
      </div>
    </div>
  );
}

function Clock({ ms, running }: { ms: number; running: boolean }) {
  return <span className={`clock ${running ? 'running' : ''} ${ms < 20000 ? 'low' : ''}`}>{fmtClock(ms)}</span>;
}

function fmtClock(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

function Game({ setup, onExit }: { setup: Setup; onExit: () => void }) {
  const navigate = useNavigate();
  const { bot, color, tc } = setup;
  const [tree, setTree] = useState<MoveTree>(() =>
    createTree(undefined, {
      Event: 'Casual game',
      Date: new Date().toISOString().slice(0, 10).replace(/-/g, '.'),
      White: color === 'white' ? 'You' : `${bot.name} (${bot.rating})`,
      Black: color === 'black' ? 'You' : `${bot.name} (${bot.rating})`,
    }),
  );
  const [currentId, setCurrentId] = useState('root');
  const [viewId, setViewId] = useState<string | null>(null); // browsing history
  const [result, setResult] = useState<{ score: string; reason: string } | null>(null);
  const [clocks, setClocks] = useState({ white: tc.base * 1000, black: tc.base * 1000 });
  const [hint, setHint] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  const turnStart = useRef(performance.now());
  const abort = useRef<AbortController | null>(null);

  const node = tree.nodes[currentId];
  const shown = tree.nodes[viewId ?? currentId];
  const turn: Side = node.fen.split(' ')[1] === 'w' ? 'white' : 'black';

  const finish = useCallback((score: string, reason: string) => {
    abort.current?.abort();
    setResult({ score, reason });
    playMoveSound('end');
  }, []);

  // Detect game end after each move.
  useEffect(() => {
    if (result) return;
    if (isRepetition(tree, currentId)) return finish('1/2-1/2', 'threefold repetition');
    const chess = new Chess(node.fen);
    if (!chess.isGameOver()) return;
    if (chess.isCheckmate()) finish(turn === 'white' ? '0-1' : '1-0', 'checkmate');
    else if (chess.isStalemate()) finish('1/2-1/2', 'stalemate');
    else if (chess.isInsufficientMaterial()) finish('1/2-1/2', 'insufficient material');
    else finish('1/2-1/2', '50-move rule');
  }, [node.fen, turn, finish, tree, currentId, result]);

  const applyMove = useCallback(
    (uci: string) => {
      const now = performance.now();
      const spent = now - turnStart.current;
      turnStart.current = now;
      if (tc.base) setClocks((c) => ({ ...c, [turn]: c[turn] - spent + tc.inc * 1000 }));
      const r = addMove(tree, currentId, uci);
      if (!r) return;
      setTree(r.tree);
      setCurrentId(r.id);
      setHint(null);
      setViewId(null);
    },
    [tree, currentId, tc, turn],
  );

  // Bot's turn.
  useEffect(() => {
    if (result || turn === color) return;
    const ctrl = new AbortController();
    abort.current = ctrl;
    setThinking(true);
    const started = performance.now();
    void botMove(botEngine(), bot, node.fen, ctrl.signal).then(async (mv) => {
      // Small minimum delay so instant bot replies feel natural.
      const wait = 350 - (performance.now() - started);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      if (ctrl.signal.aborted || !mv) return;
      setThinking(false);
      applyMove(mv);
    });
    return () => ctrl.abort();
  }, [turn, color, result, bot, node.fen, applyMove]);

  // Clock ticking + flag.
  const [, force] = useState(0);
  useEffect(() => {
    if (!tc.base || result || node.ply === 0) return;
    const id = setInterval(() => {
      force((x) => x + 1);
      const left = clocks[turn] - (performance.now() - turnStart.current);
      if (left <= 0) finish(turn === 'white' ? '0-1' : '1-0', `${turn} ran out of time`);
    }, 200);
    return () => clearInterval(id);
  }, [tc.base, result, turn, clocks, node.ply, finish]);
  const live = (side: Side) =>
    side === turn && !result && node.ply > 0 ? clocks[side] - (performance.now() - turnStart.current) : clocks[side];

  useEffect(() => () => botEngine().cancelAll(), []);

  const takeback = () => {
    // Undo to the last position where it's the user's turn.
    let id = currentId;
    do {
      const p = tree.nodes[id].parent;
      if (!p) break;
      id = p;
    } while (tree.nodes[id].fen.split(' ')[1] !== color[0] && tree.nodes[id].parent);
    abort.current?.abort();
    setThinking(false);
    setCurrentId(id);
    setViewId(null);
    turnStart.current = performance.now();
  };

  const getHint = async () => {
    const r = await analysisEngine().analyze(node.fen, { depth: 12 });
    if (r.bestMove) setHint(r.bestMove);
  };

  const pgnWithResult = (res: string) => {
    const t = { ...tree, headers: { ...tree.headers, Result: res } };
    // Truncate to current line (takebacks leave variations).
    const line = mainlineTo(t, currentId);
    return treeToPgn(line) + (treeToPgn(line).trim().endsWith(res) ? '' : ` ${res}`);
  };

  const review = async () => {
    const id = await saveGame(pgnWithResult(result?.score ?? '*'), 'bot');
    navigate(`/review/${id}`);
  };

  const shapes = useMemo(() => (hint ? [arrow(hint, 'blue')] : []), [hint]);
  const opp: Side = color === 'white' ? 'black' : 'white';
  return (
    <div className="board-layout">
      <div>
        <PlayerStrip
          name={bot.name}
          color={opp}
          avatar={bot.avatar}
          meta={thinking ? 'thinking…' : bot.id === 'apex' ? 'full strength' : `~${bot.rating}`}
          right={tc.base > 0 && <Clock ms={live(opp)} running={turn === opp && !result && node.ply > 0} />}
        />
        <Board
          fen={shown.fen}
          orientation={color}
          movable={!result && !viewId && turn === color ? color : undefined}
          onMove={applyMove}
          lastMove={shown.uci}
          shapes={shapes}
        />
        <PlayerStrip
          name="You"
          color={color}
          meta={`playing ${color}`}
          right={tc.base > 0 && <Clock ms={live(color)} running={turn === color && !result && node.ply > 0} />}
        />
      </div>
      <div className="side-col">
        {result && (
          <div className="panel">
            <h2>
              {result.score === '1/2-1/2' ? 'Draw' : (result.score === '1-0') === (color === 'white') ? 'You won!' : `${bot.name} won`}
            </h2>
            <div className="muted">By {result.reason}.</div>
            <div className="btn-row" style={{ marginTop: 12 }}>
              <button className="btn primary" onClick={() => void review()}>Review this game</button>
              <button className="btn" onClick={onExit}>New game</button>
            </div>
          </div>
        )}
        <MoveList tree={mainlineTo(tree, currentId)} currentId={viewId ?? currentId} onSelect={(id) => setViewId(id === currentId ? null : id)} />
        {!result && (
          <div className="ctrl-bar">
            <button className="icon-btn" onClick={() => void getHint()} disabled={turn !== color}><Lightbulb size={17} /> Hint</button>
            <button className="icon-btn" onClick={takeback} disabled={node.ply < 2 && color === 'white'}><Undo2 size={17} /> Takeback</button>
            <button className="icon-btn" onClick={() => finish('1/2-1/2', 'agreement')}><Handshake size={17} /> Draw</button>
            <button className="icon-btn" onClick={() => finish(color === 'white' ? '0-1' : '1-0', 'resignation')}><Flag size={17} /> Resign</button>
          </div>
        )}
        {viewId && (
          <button className="btn" onClick={() => setViewId(null)}>Back to current position</button>
        )}
      </div>
    </div>
  );
}

/** Copy of the tree containing only the path to `id` (takebacks leave abandoned branches). */
function mainlineTo(tree: MoveTree, id: string): MoveTree {
  const keep = new Set<string>();
  let cur: string | null = id;
  while (cur) {
    keep.add(cur);
    cur = tree.nodes[cur].parent;
  }
  const nodes: MoveTree['nodes'] = {};
  for (const k of keep) {
    const n = tree.nodes[k];
    nodes[k] = { ...n, children: n.children.filter((c) => keep.has(c)) };
  }
  return { ...tree, nodes };
}

function isRepetition(tree: MoveTree, id: string): boolean {
  const key = (f: string) => f.split(' ').slice(0, 4).join(' ');
  const target = key(tree.nodes[id].fen);
  let count = 0;
  for (const n of mainline(mainlineTo(tree, id))) if (key(n.fen) === target) count++;
  return count >= 3;
}
