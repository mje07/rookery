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
import { deleteGame, pgnSummary, saveGame } from '../features/review/gameLibrary';
import type { PlyReview, ReviewData } from '../features/review/types';
import { useSettings } from '../lib/settings';
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
      <h1>Game Review</h1>
      <p className="muted">
        Paste or upload a PGN. Every move is checked by Stockfish and graded, and the mistakes become practice positions.
      </p>
      <div className="panel">
        <textarea rows={8} placeholder={'[Event "..."]\n1. e4 e5 2. Nf3 ...'} value={text} onChange={(e) => setText(e.target.value)} />
        {error && <div className="error small">{error}</div>}
        <div className="btn-row" style={{ marginTop: 10 }}>
          <button className="btn primary" onClick={() => void ingest(text)} disabled={!text.trim()}>
            Review
          </button>
          <label className="btn">
            Upload .pgn
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
                <span>
                  <b>{g.white}</b> vs <b>{g.black}</b> <span className="muted">· {g.result}{g.date ? ` · ${g.date}` : ''}</span>
                  {g.source === 'bot' && <span className="tag" style={{ marginLeft: 8 }}>bot game</span>}
                </span>
                <span className="btn-row">
                  {r ? (
                    <span className="small muted">
                      {r.accuracy.w.toFixed(1)} / {r.accuracy.b.toFixed(1)}
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
                    ✕
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
  const depth = useSettings((s) => s.reviewDepth);
  const settingsLoaded = useSettings((s) => s.loaded);
  const [game, setGame] = useState<GameRecord | null | undefined>(undefined);
  const [review, setReview] = useState<ReviewData | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState('');
  const [index, setIndex] = useState(0);
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  const [showBest, setShowBest] = useState(true);
  const [retry, setRetry] = useState<RetryState>(null);
  const runRef = useRef<AbortController | null>(null);

  const tree = useMemo(() => (game ? treeFromPgn(game.pgn) : null), [game]);
  const positions = useMemo(() => (tree ? mainline(tree).map((n) => n.fen) : []), [tree]);

  useEffect(() => {
    void db.games.get(id).then((g) => setGame(g ?? null));
  }, [id]);

  const run = useCallback(
    async (force = false) => {
      if (!tree || !settingsLoaded) return;
      const cached = await db.reviews.get(id);
      if (cached && !force && cached.depth >= depth) {
        setReview(cached.data);
        return;
      }
      runRef.current?.abort();
      const ctrl = new AbortController();
      runRef.current = ctrl;
      setReview(null);
      setError('');
      try {
        const book = await loadBook();
        const data = await analyzeGame(tree, analysisEngine(), book, {
          depth,
          signal: ctrl.signal,
          onProgress: setProgress,
        });
        await db.reviews.put({ gameId: id, depth, createdAt: Date.now(), data });
        setReview(data);
        setProgress(null);
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setError(String(e));
      }
    },
    [tree, id, depth, settingsLoaded],
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
    setIndex(Math.max(0, Math.min(total, i)));
  }, [total]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft') go(index - 1);
      else if (e.key === 'ArrowRight') go(index + 1);
      else if (e.key === 'Home') go(0);
      else if (e.key === 'End') go(total);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, index, total]);

  if (game === undefined) return <div className="page-loading">Loading…</div>;
  if (game === null) return <div className="empty">Game not found.</div>;

  const ply = review && index > 0 ? review.plies[index - 1] : null;
  const keyMoments = review ? review.plies.filter((p) => KEY_CLASSES.includes(p.classification)) : [];
  const nextKey = (dir: 1 | -1) => {
    if (!review) return;
    const list = dir === 1 ? keyMoments.filter((p) => p.ply > index) : keyMoments.filter((p) => p.ply < index).reverse();
    if (list[0]) go(list[0].ply);
  };

  // ---------- board state
  let boardFen = positions[index];
  let lastMove = ply?.uci;
  let shapes = [] as ReturnType<typeof arrow>[];
  let badge: { square: string; color: string; glyph: string } | undefined;
  if (retry) {
    boardFen = retry.fen;
    lastMove = undefined;
  } else if (ply) {
    const meta = CLASS_META[ply.classification];
    badge = { square: ply.uci.slice(2, 4), color: meta.color, glyph: meta.glyph };
    if (showBest && ply.bestUci && ply.bestUci !== ply.uci && !['book', 'best', 'brilliant', 'great'].includes(ply.classification)) {
      shapes = [arrow(ply.bestUci, 'green')];
    }
  }
  const evalScore = retry ? undefined : review ? (index === 0 ? review.plies[0]?.evalBefore : ply?.evalAfter) : undefined;

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
    const r = await analysisEngine().analyze(chess.fen(), { depth: Math.min(depth, 14) });
    const after = chess.isCheckmate() ? { mate: retry.ply.color === 'w' ? 1 : -1 } : r.lines[0]?.score ?? { cp: 0 };
    const loss = retry.ply.winBefore - winPctFor(after, retry.ply.color);
    if (loss <= 2) playMoveSound('success');
    else playMoveSound('fail');
    setRetry((cur) => cur && { ...cur, status: loss <= 2 ? 'ok' : 'wrong' });
  };

  return (
    <div className="board-layout">
      <div>
        <div className="player-strip">
          <span>{orientation === 'white' ? game.black : game.white}</span>
          {review && <span className="muted small">{review.opening ? `${review.opening.eco} ${review.opening.name}` : ''}</span>}
        </div>
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
        <div className="player-strip">
          <span>{orientation === 'white' ? game.white : game.black}</span>
          <span className="muted small">{game.result}</span>
        </div>
      </div>

      <div className="side-col">
        {!review && (
          <div className="panel">
            <h2>Analysing…</h2>
            {error ? (
              <div className="error">{error}</div>
            ) : (
              <>
                <div className="progress">
                  <div style={{ width: `${progress ? (progress.done / progress.total) * 100 : 0}%` }} />
                </div>
                <div className="muted small" style={{ marginTop: 6 }}>
                  {progress ? `${progress.done} / ${progress.total} positions · depth ${depth}` : 'Starting engine…'}
                </div>
              </>
            )}
          </div>
        )}

        {review && (
          <>
            <Summary review={review} white={game.white} black={game.black} />
            <div className="panel">
              <CoachBox ply={ply} retry={retry} review={review} onRetry={startRetry} />
              <div className="btn-row" style={{ marginTop: 10 }}>
                {retry ? (
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
              whiteWins={review.whiteWins}
              current={index}
              onSelect={go}
              marks={review.plies
                .filter((p) => ['blunder', 'mistake', 'miss', 'brilliant', 'great'].includes(p.classification))
                .map((p) => ({ index: p.ply, color: CLASS_META[p.classification].color }))}
            />
            <MoveTable review={review} index={index} onSelect={go} />
          </>
        )}

        <div className="btn-row">
          <button className="btn" onClick={() => go(0)}>⏮</button>
          <button className="btn" onClick={() => go(index - 1)}>◀</button>
          <button className="btn" onClick={() => go(index + 1)}>▶</button>
          <button className="btn" onClick={() => go(total)}>⏭</button>
          <button className="btn" onClick={() => setOrientation((o) => (o === 'white' ? 'black' : 'white'))}>Flip</button>
          <button className="btn" onClick={() => navigate('/analysis', { state: { fen: positions[index] } })}>Analyse position</button>
          {review && <button className="btn" onClick={() => void run(true)}>Re-run</button>}
          <button className="btn ghost" onClick={() => navigate('/review')}>All games</button>
        </div>
      </div>
    </div>
  );
}

function Summary({ review, white, black }: { review: ReviewData; white: string; black: string }) {
  return (
    <div className="panel">
      <div className="review-summary">
        <div className="hdr">{white}</div>
        <div />
        <div className="hdr" style={{ textAlign: 'right' }}>{black}</div>
        <div className="acc-box white">{review.accuracy.w.toFixed(1)}</div>
        <div className="center">Accuracy</div>
        <div className="acc-box black">{review.accuracy.b.toFixed(1)}</div>
        <div className="num">{review.rating.w}</div>
        <div className="center" title="A rough estimate from accuracy alone">Game rating ≈</div>
        <div className="num">{review.rating.b}</div>
        {ALL_CLASSES.map((c) => {
          const m = CLASS_META[c];
          return (
            <Row key={c} w={review.counts.w[c]} b={review.counts.b[c]}>
              <span className="class-dot" style={{ background: m.color }}>{m.glyph}</span> {m.label}
            </Row>
          );
        })}
      </div>
    </div>
  );
}

function Row({ w, b, children }: { w: number; b: number; children: React.ReactNode }) {
  return (
    <>
      <div className="num" style={{ color: w ? undefined : 'var(--muted)' }}>{w}</div>
      <div className="center">{children}</div>
      <div className="num" style={{ color: b ? undefined : 'var(--muted)' }}>{b}</div>
    </>
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
      <span className="class-dot" style={{ background: m.color }}>{m.glyph}</span>
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
                  <span className="class-dot" style={{ background: CLASS_META[p.classification].color, width: 16, height: 16, fontSize: 8 }}>
                    {CLASS_META[p.classification].glyph}
                  </span>
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
