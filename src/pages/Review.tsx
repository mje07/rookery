import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Chess } from 'chess.js';
import { Board, arrow } from '../components/Board';
import { EvalBar } from '../components/EvalBar';
import { EvalGraph } from '../components/EvalGraph';
import { db, type GameRecord } from '../db/db';
import { analysisEngine } from '../engine/EngineService';
import { mainline, moveNumberLabel, splitPgn, treeFromPgn } from '../chess/tree';
import { winPctFor } from '../chess/evalMath';
import { loadBook } from '../features/openings/book';
import { analyzeGame, ALL_CLASSES } from '../features/review/analyzeGame';
import { CLASS_META, KEY_CLASSES } from '../features/review/classMeta';
import { ClassIcon } from '../features/review/ClassIcon';
import { classBadgeSvg } from '../features/review/classIcons';
import { deleteGame, pgnSummary, saveGame } from '../features/review/gameLibrary';
import type { PlyReview, ReviewData } from '../features/review/types';
import { REVIEW_NODES, useSettings } from '../lib/settings';
import { NavBar, PageHeader, PlayerStrip } from '../components/ui';
import { ArrowLeft, BookmarkPlus, ChevronLeft, ChevronRight, Microscope, Play, RotateCcw, Trash2, Upload, X } from 'lucide-react';
import { bankGameMistakes } from '../features/mistakes/bank';
import { markDone } from '../features/path/daily';
import { playMoveSound } from '../lib/sound';

export default function Review() {
  const { gameId } = useParams();
  return gameId ? <ReviewGame key={gameId} id={Number(gameId)} /> : <ReviewHome />;
}

/* ------------------------------------------------------------------ import + library */

function ReviewHome() {
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [pending, setPending] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [games, setGames] = useState<GameRecord[]>([]);
  const [reviewed, setReviewed] = useState<Map<number, ReviewData>>(new Map());

  const refresh = useCallback(async () => {
    const g = await db.games.orderBy('addedAt').reverse().toArray();
    setGames(g);
    const r = await db.reviews.bulkGet(g.map((x) => x.id!));
    setReviewed(new Map(r.filter((x) => !!x).map((x) => [x!.gameId, x!.data])));
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const ingest = async (raw: string) => {
    setError('');
    const parts = splitPgn(raw);
    if (!parts.length) return setError('No games found in that text.');
    if (parts.length === 1) {
      try {
        const id = await saveGame(parts[0], 'import');
        navigate(`/review/${id}`);
      } catch (e) {
        setError(`Couldn't read that PGN: ${(e as Error).message}`);
      }
      return;
    }
    setPending(parts);
  };

  return (
    <div style={{ maxWidth: 900 }}>
      <PageHeader
        title="Game Review"
        subtitle="Paste or upload a PGN. Stockfish checks and grades every move, and your mistakes become practice positions."
      />
      <div className="panel">
        <textarea rows={8} placeholder={'[Event "..."]\n1. e4 e5 2. Nf3 ...'} value={text} onChange={(e) => setText(e.target.value)} />
        {error && <div className="error small">{error}</div>}
        <div className="btn-row" style={{ marginTop: 10 }}>
          <button className="btn primary" onClick={() => void ingest(text)} disabled={!text.trim()}>
            Review
          </button>
          <label className="btn">
            <Upload size={16} /> Upload .pgn
            <input
              type="file"
              accept=".pgn,text/plain"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) await ingest(await f.text());
                e.target.value = '';
              }}
            />
          </label>
        </div>
      </div>

      {pending.length > 0 && (
        <>
          <div className="section-title">{pending.length} games in file</div>
          <div className="game-list">
            {pending.map((p, i) => {
              const s = pgnSummary(p);
              return (
                <div key={i} className="game-row" onClick={async () => s.ok && navigate(`/review/${await saveGame(p, 'import')}`)}>
                  <span>{s.label}</span>
                  {s.ok ? <span className="tag">Review →</span> : <span className="error small">{s.error}</span>}
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className="section-title">Your games</div>
      {games.length === 0 ? (
        <div className="empty">No games yet. Import one above, or play a bot.</div>
      ) : (
        <div className="game-list">
          {games.map((g) => {
            const r = reviewed.get(g.id!);
            return (
              <div key={g.id} className="game-row" onClick={() => navigate(`/review/${g.id}`)}>
                <span className="btn-row" style={{ gap: 10 }}>
                  <span className="result-pill">{g.result}</span>
                  <span>
                    <b>{g.white}</b> <span className="muted">vs</span> <b>{g.black}</b>
                    {g.date && <span className="muted small"> · {g.date}</span>}
                  </span>
                  {g.source === 'bot' && <span className="tag">bot game</span>}
                </span>
                <span className="btn-row">
                  {r ? (
                    <span className="small muted">
                      Accuracy {r.accuracy.w.toFixed(1)} · {r.accuracy.b.toFixed(1)}
                    </span>
                  ) : (
                    <span className="tag">not reviewed</span>
                  )}
                  <button
                    className="btn small ghost"
                    title="Delete"
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (confirm('Delete this game and its review?')) {
                        await deleteGame(g.id!);
                        void refresh();
                      }
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ review of one game */

type RetryState = { ply: PlyReview; status: 'waiting' | 'checking' | 'right' | 'ok' | 'wrong'; tried?: string; fen: string } | null;

function ReviewGame({ id }: { id: number }) {
  const navigate = useNavigate();
  const quality = useSettings((s) => s.reviewQuality);
  const budget = REVIEW_NODES[quality];
  const settingsLoaded = useSettings((s) => s.loaded);
  const [game, setGame] = useState<GameRecord | null | undefined>(undefined);
  const [review, setReview] = useState<ReviewData | null>(null);
  /** Moves analysed so far, while the full review is still running. */
  const [partial, setPartial] = useState<ReviewData | null>(null);
  /** Stepping through an engine line on the board: SAN moves from `fen`, showing the first `step`. */
  const [line, setLine] = useState<{ fen: string; sans: string[]; step: number; label: string } | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState('');
  const [index, setIndex] = useState(0);
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  const [showBest, setShowBest] = useState(true);
  const [retry, setRetry] = useState<RetryState>(null);
  const runRef = useRef<AbortController | null>(null);
  const [banked, setBanked] = useState<number | null>(null);

  const bank = useCallback(
    async (color: 'white' | 'black') => {
      if (!review || !game?.id) return;
      const n = await bankGameMistakes(game.id, review, color);
      setBanked(n);
      setGame((g) => (g ? { ...g, mistakesBanked: true, userColor: g.userColor ?? color } : g));
    },
    [review, game],
  );

  // Bot games: the user's side is known, so mistakes go to the trainer automatically.
  useEffect(() => {
    if (!review || !game?.id || game.source !== 'bot' || !game.userColor || game.mistakesBanked) return;
    void bank(game.userColor);
    if (game.addedAt >= new Date().setHours(0, 0, 0, 0)) void markDone('review');
  }, [review, game, bank]);

  const tree = useMemo(() => (game ? treeFromPgn(game.pgn) : null), [game]);
  const positions = useMemo(() => (tree ? mainline(tree).map((n) => n.fen) : []), [tree]);

  useEffect(() => {
    void db.games.get(id).then((g) => setGame(g ?? null));
  }, [id]);

  const run = useCallback(
    async (force = false) => {
      if (!tree || !settingsLoaded) return;
      const cached = await db.reviews.get(id);
      // Older depth-based reviews (no `nodes`) are kept until the user re-runs them.
      if (cached && !force && (cached.nodes === undefined || cached.nodes >= budget)) {
        setReview(cached.data);
        return;
      }
      runRef.current?.abort();
      const ctrl = new AbortController();
      runRef.current = ctrl;
      setReview(null);
      setPartial(null);
      setError('');
      try {
        const book = await loadBook();
        const started = performance.now();
        const data = await analyzeGame(tree, analysisEngine(), book, {
          nodes: budget,
          signal: ctrl.signal,
          onProgress: setProgress,
          onPartial: setPartial,
        });
        await db.reviews.put({ gameId: id, depth: 0, nodes: budget, createdAt: Date.now(), data });
        console.info(`Review: ${data.plies.length} moves in ${((performance.now() - started) / 1000).toFixed(1)}s`);
        setReview(data);
        setPartial(null);
        setProgress(null);
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setError(String(e));
      }
    },
    [tree, id, budget, settingsLoaded],
  );

  useEffect(() => {
    void run();
    return () => {
      runRef.current?.abort();
      analysisEngine().cancelAll();
    };
  }, [run]);

  const total = positions.length - 1;
  const go = useCallback((i: number) => {
    setRetry(null);
    setLine(null);
    setIndex(Math.max(0, Math.min(total, i)));
  }, [total]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'TEXTAREA') return;
      if (line) {
        if (e.key === 'ArrowLeft') setLine({ ...line, step: Math.max(0, line.step - 1) });
        else if (e.key === 'ArrowRight') setLine({ ...line, step: Math.min(line.sans.length, line.step + 1) });
        else if (e.key === 'Escape') setLine(null);
        else return;
        e.preventDefault();
        return;
      }
      if (e.key === 'ArrowLeft') go(index - 1);
      else if (e.key === 'ArrowRight') go(index + 1);
      else if (e.key === 'Home') go(0);
      else if (e.key === 'End') go(total);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, index, total, line]);

  if (game === undefined) return <div className="page-loading">Loading…</div>;
  if (game === null) return <div className="empty">Game not found.</div>;

  const shown = review ?? partial;
  const ply = shown && index > 0 ? shown.plies[index - 1] ?? null : null;
  const keyMoments = shown ? shown.plies.filter((p) => KEY_CLASSES.includes(p.classification)) : [];
  const nextKey = (dir: 1 | -1) => {
    if (!shown) return;
    const list = dir === 1 ? keyMoments.filter((p) => p.ply > index) : keyMoments.filter((p) => p.ply < index).reverse();
    if (list[0]) go(list[0].ply);
  };

  // ---------- board state
  let boardFen = positions[index];
  let lastMove = ply?.uci;
  let shapes = [] as ReturnType<typeof arrow>[];
  let badge: { square: string; svg: string } | undefined;
  if (line) {
    const c = new Chess(line.fen);
    let last: string | undefined;
    for (const san of line.sans.slice(0, line.step)) {
      const m = c.move(san);
      last = m.from + m.to + (m.promotion ?? '');
    }
    boardFen = c.fen();
    lastMove = last;
  } else if (retry) {
    boardFen = retry.fen;
    lastMove = undefined;
  } else if (ply) {
    badge = { square: ply.uci.slice(2, 4), svg: classBadgeSvg(ply.classification) };
    if (showBest && ply.bestUci && ply.bestUci !== ply.uci && !['book', 'best', 'brilliant', 'great'].includes(ply.classification)) {
      shapes = [arrow(ply.bestUci, 'green')];
    }
  }
  const evalScore = retry || line ? undefined : shown ? (index === 0 ? shown.plies[0]?.evalBefore : ply?.evalAfter) : undefined;
  const openLine = (fen: string, sans: string[], label: string) => setLine({ fen, sans, step: 1, label });
  const engineThreads = analysisEngine().getInfo()?.threads ?? 1;

  const startRetry = (p: PlyReview) => {
    setIndex(p.ply);
    setRetry({ ply: p, status: 'waiting', fen: p.fenBefore });
    setOrientation(p.color === 'w' ? 'white' : 'black');
  };

  const onRetryMove = async (uci: string) => {
    if (!retry || retry.status !== 'waiting') return;
    const chess = new Chess(retry.ply.fenBefore);
    const m = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    setRetry({ ...retry, fen: chess.fen(), status: 'checking', tried: m.san });
    if (uci === retry.ply.bestUci) {
      playMoveSound('success');
      return setRetry((r) => r && { ...r, status: 'right' });
    }
    // Judge alternatives by the engine: within the "excellent" band counts.
    const r = await analysisEngine().analyze(chess.fen(), { nodes: 300_000 });
    const after = chess.isCheckmate() ? { mate: retry.ply.color === 'w' ? 1 : -1 } : r.lines[0]?.score ?? { cp: 0 };
    const loss = retry.ply.winBefore - winPctFor(after, retry.ply.color);
    if (loss <= 2) playMoveSound('success');
    else playMoveSound('fail');
    setRetry((cur) => cur && { ...cur, status: loss <= 2 ? 'ok' : 'wrong' });
  };

  return (
    <div className="board-layout">
      <div>
        <PlayerStrip
          name={orientation === 'white' ? game.black : game.white}
          color={orientation === 'white' ? 'black' : 'white'}
          right={review?.opening && <span className="tag">{review.opening.eco} · {review.opening.name}</span>}
        />
        <div className="board-col">
          <EvalBar score={evalScore} orientation={orientation} />
          <Board
            fen={boardFen}
            orientation={orientation}
            lastMove={lastMove}
            shapes={shapes}
            badge={badge}
            movable={retry?.status === 'waiting' ? (retry.ply.color === 'w' ? 'white' : 'black') : undefined}
            onMove={onRetryMove}
          />
        </div>
        <PlayerStrip
          name={orientation === 'white' ? game.white : game.black}
          color={orientation}
          right={<span className="result-pill">{game.result}</span>}
        />
      </div>

      <div className="side-col">
        {!review && (
          <div className="panel">
            <h2 style={{ marginBottom: 8 }}>Analysing your game…</h2>
            {error ? (
              <div className="error">{error}</div>
            ) : (
              <>
                <div className="progress">
                  <div style={{ width: `${progress ? (progress.done / progress.total) * 100 : 0}%` }} />
                </div>
                <div className="muted small" style={{ marginTop: 6 }}>
                  {progress
                    ? `${progress.done} / ${progress.total} positions · ${quality} quality${engineThreads > 1 ? ` · ${engineThreads} threads` : ''}. Results appear as they’re ready.`
                    : 'Starting engine…'}
                </div>
              </>
            )}
          </div>
        )}

        {shown && (
          <>
            <Summary review={shown} white={game.white} black={game.black} />
            {banked !== null && (
              <div className="feedback ok">
                <BookmarkPlus size={18} />
                <span>{banked ? `${banked} of your mistakes were added to the mistake trainer.` : 'No mistakes to add. Clean game!'}</span>
              </div>
            )}
            {review && banked === null && !game.mistakesBanked && game.source !== 'bot' && (
              <div className="panel small">
                <div className="btn-row" style={{ justifyContent: 'space-between' }}>
                  <span className="muted">Practise your mistakes from this game. Which side were you?</span>
                  <span className="btn-row">
                    <button className="btn small" onClick={() => void bank('white')}>White</button>
                    <button className="btn small" onClick={() => void bank('black')}>Black</button>
                  </span>
                </div>
              </div>
            )}
            <div className="panel">
              {line ? (
                <LineViewer line={line} onStep={(step) => setLine({ ...line, step })} onClose={() => setLine(null)} />
              ) : (
                <CoachBox ply={ply} retry={retry} review={shown} onRetry={startRetry} />
              )}
              {!line && !retry && ply && (
                <div className="btn-row" style={{ marginTop: 10 }}>
                  {ply.bestSan && ply.bestUci !== ply.uci && ply.bestLine.length > 0 && (
                    <button className="btn small" onClick={() => openLine(ply.fenBefore, ply.bestLine, `Instead of ${ply.san}`)}>
                      <Play size={14} /> Show {ply.bestSan} line
                    </button>
                  )}
                  {ply.replyLine.length > 0 && (
                    <button className="btn small ghost" onClick={() => openLine(ply.fenAfter, ply.replyLine, 'Engine line from here')}>
                      <Play size={14} /> Engine line from here
                    </button>
                  )}
                </div>
              )}
              <div className="btn-row" style={{ marginTop: 10 }}>
                {line ? null : retry ? (
                  <>
                    {retry.status !== 'waiting' && retry.status !== 'checking' && (
                      <button className="btn" onClick={() => startRetry(retry.ply)}>Try again</button>
                    )}
                    <button className="btn" onClick={() => setRetry(null)}>Back to review</button>
                  </>
                ) : (
                  <>
                    <button className="btn small" onClick={() => nextKey(-1)} disabled={!keyMoments.some((p) => p.ply < index)}>◀ Key moment</button>
                    <button className="btn small" onClick={() => nextKey(1)} disabled={!keyMoments.some((p) => p.ply > index)}>Key moment ▶</button>
                    <label className="small btn-row">
                      <input type="checkbox" checked={showBest} onChange={(e) => setShowBest(e.target.checked)} /> Best-move arrow
                    </label>
                  </>
                )}
              </div>
            </div>
            <EvalGraph
              whiteWins={shown.whiteWins}
              current={index}
              onSelect={go}
              marks={shown.plies
                .filter((p) => ['blunder', 'mistake', 'miss', 'brilliant', 'great'].includes(p.classification))
                .map((p) => ({ index: p.ply, color: CLASS_META[p.classification].color }))}
            />
            <MoveTable review={shown} index={index} onSelect={go} />
          </>
        )}

        <NavBar
          onFirst={() => go(0)}
          onPrev={() => go(index - 1)}
          onNext={() => go(index + 1)}
          onLast={() => go(total)}
          onFlip={() => setOrientation((o) => (o === 'white' ? 'black' : 'white'))}
        >
          <button className="icon-btn" title="Open this position on the analysis board" onClick={() => navigate('/analysis', { state: { fen: positions[index] } })}>
            <Microscope size={18} />
          </button>
        </NavBar>
        <div className="btn-row">
          <button className="btn ghost small" onClick={() => navigate('/review')}><ArrowLeft size={15} /> All games</button>
          {review && <button className="btn ghost small" onClick={() => void run(true)}><RotateCcw size={15} /> Re-run analysis</button>}
        </div>
      </div>
    </div>
  );
}

/** Step through an engine line on the board. */
function LineViewer({
  line,
  onStep,
  onClose,
}: {
  line: { fen: string; sans: string[]; step: number; label: string };
  onStep: (step: number) => void;
  onClose: () => void;
}) {
  const startNo = parseInt(line.fen.split(' ')[5] ?? '1', 10) || 1;
  const blackFirst = line.fen.split(' ')[1] === 'b';
  return (
    <div>
      <div className="btn-row" style={{ justifyContent: 'space-between' }}>
        <div className="coach-title">{line.label}</div>
        <button className="btn small ghost" onClick={onClose} title="Back to the game (Esc)"><X size={15} /></button>
      </div>
      <div className="line-moves">
        {line.sans.map((san, i) => {
          const ply = i + (blackFirst ? 1 : 0);
          const num = startNo + Math.floor(ply / 2);
          const label = ply % 2 === 0 ? `${num}.` : i === 0 ? `${num}…` : '';
          return (
            <span key={i}>
              {label && <span className="mv-num">{label}</span>}
              <span className={`mv ${i + 1 === line.step ? 'active' : ''}`} onClick={() => onStep(i + 1)}>{san}</span>{' '}
            </span>
          );
        })}
      </div>
      <div className="btn-row" style={{ marginTop: 8 }}>
        <button className="btn small" onClick={() => onStep(Math.max(0, line.step - 1))} disabled={line.step === 0}><ChevronLeft size={15} /></button>
        <button className="btn small" onClick={() => onStep(Math.min(line.sans.length, line.step + 1))} disabled={line.step >= line.sans.length}><ChevronRight size={15} /></button>
        <span className="muted small">← → to step · Esc to return</span>
      </div>
    </div>
  );
}

function Summary({ review, white, black }: { review: ReviewData; white: string; black: string }) {
  // The rating estimate is meaningless for very short games.
  const showRating = review.plies.length >= 16;
  return (
    <div className="panel review-summary">
      <div className="acc-head">
        <div className="acc-side">
          <span className="acc-name" title={white}>{white}</span>
          <span className="acc-box white">{review.accuracy.w.toFixed(1)}</span>
          {showRating && <span className="acc-rating">Game rating ≈ <b>{review.rating.w}</b></span>}
        </div>
        <div className="acc-mid">Accuracy</div>
        <div className="acc-side right">
          <span className="acc-name" title={black}>{black}</span>
          <span className="acc-box black">{review.accuracy.b.toFixed(1)}</span>
          {showRating && <span className="acc-rating">Game rating ≈ <b>{review.rating.b}</b></span>}
        </div>
      </div>
      <div className="class-table">
        {ALL_CLASSES.map((c) => {
          const m = CLASS_META[c];
          const w = review.counts.w[c];
          const b = review.counts.b[c];
          const dim = !w && !b;
          return (
            <div key={c} style={{ display: 'contents' }}>
              <div className={`num ${w ? '' : 'zero'}`}>{w}</div>
              <div className="lbl" style={{ opacity: dim ? 0.45 : 1 }}>
                <ClassIcon cls={c} size={18} /> {m.label}
              </div>
              <div className={`num ${b ? '' : 'zero'}`}>{b}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CoachBox({
  ply,
  retry,
  review,
  onRetry,
}: {
  ply: PlyReview | null;
  retry: RetryState;
  review: ReviewData;
  onRetry: (p: PlyReview) => void;
}) {
  if (retry) {
    const msg = {
      waiting: `Find a better move than ${retry.ply.san}.`,
      checking: `Checking ${retry.tried}…`,
      right: `${retry.tried} is the best move.`,
      ok: `${retry.tried} works too. The engine's top choice was ${retry.ply.bestSan}.`,
      wrong: `${retry.tried} isn't it. Try again, or look at the hint.`,
    }[retry.status];
    return (
      <div>
        <div className="coach-title">Retry</div>
        <div className={`feedback ${retry.status === 'right' || retry.status === 'ok' ? 'ok' : retry.status === 'wrong' ? 'bad' : 'info'}`}>{msg}</div>
        {retry.status === 'wrong' && retry.ply.bestSan && (
          <details className="small" style={{ marginTop: 6 }}>
            <summary>Show solution</summary>
            {retry.ply.bestLine.slice(0, 5).join(' ')}
          </details>
        )}
      </div>
    );
  }
  if (!ply) {
    return (
      <div>
        <div className="coach-title">Start of game</div>
        <div className="muted small">
          {review.opening ? `${review.opening.name}. ` : ''}Use → or the key-moment buttons to step through the game.
        </div>
      </div>
    );
  }
  const m = CLASS_META[ply.classification];
  const canRetry = ['inaccuracy', 'mistake', 'miss', 'blunder'].includes(ply.classification);
  return (
    <div className="coach-box">
      <ClassIcon cls={ply.classification} size={34} />
      <div style={{ flex: 1 }}>
        <div className="coach-title">
          {moveNumberLabel(ply.fenBefore)} {ply.san} is {/^[aeiou]/i.test(m.label) ? 'an' : 'a'} {m.label.toLowerCase()} move
        </div>
        <div className="small">{ply.explanation}</div>
        {canRetry && (
          <div className="btn-row" style={{ marginTop: 8 }}>
            <button className="btn small primary" onClick={() => onRetry(ply)}>Retry this move</button>
          </div>
        )}
      </div>
    </div>
  );
}

function MoveTable({ review, index, onSelect }: { review: ReviewData; index: number; onSelect: (i: number) => void }) {
  const rows: (PlyReview | null)[][] = [];
  const firstBlack = review.plies[0]?.color === 'b';
  const list: (PlyReview | null)[] = firstBlack ? [null, ...review.plies] : review.plies;
  for (let i = 0; i < list.length; i += 2) rows.push([list[i], list[i + 1] ?? null]);
  const startNo = parseInt(review.startFen.split(' ')[5] ?? '1', 10) || 1;
  return (
    <div className="panel" style={{ padding: 8 }}>
      <div className="review-table">
        {rows.map((r, i) => (
          <div key={i} style={{ display: 'contents' }}>
            <div className="num">{startNo + i}.</div>
            {r.map((p, j) =>
              p ? (
                <div key={j} className={`cell ${index === p.ply ? 'active' : ''}`} onClick={() => onSelect(p.ply)}>
                  <ClassIcon cls={p.classification} size={16} />
                  {p.san}
                </div>
              ) : (
                <div key={j} />
              ),
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
