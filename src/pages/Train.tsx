import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Chess } from 'chess.js';
import { ArrowLeft, Check, Eye, X } from 'lucide-react';
import { Board, arrow } from '../components/Board';
import { getSetting, type MistakeCard } from '../db/db';
import { DEFAULT_RATING } from '../features/puzzles/glicko';
import { themedPuzzleNear, type Puzzle } from '../features/puzzles/data';
import { PuzzlePlayer } from '../features/puzzles/PuzzlePlayer';
import { recordRatedAttempt } from '../features/puzzles/record';
import { dueMistakes, gradeMistake } from '../features/mistakes/bank';
import { markDone, type PuzzleSetSpec } from '../features/path/daily';
import { themeLabel } from '../features/path/progress';
import { analysisEngine } from '../engine/EngineService';
import { winPctFor } from '../chess/evalMath';
import { playMoveSound } from '../lib/sound';
import { CLASS_META } from '../features/review/classMeta';
import type { Classification } from '../features/review/types';

export default function Train() {
  const { task } = useParams();
  if (task === 'mistakes') return <MistakeRunner />;
  return <PuzzleSetRunner />;
}

function BackToPlan() {
  const navigate = useNavigate();
  return (
    <button className="btn ghost small" onClick={() => navigate('/')}>
      <ArrowLeft size={15} /> Today’s plan
    </button>
  );
}

function Results({ results }: { results: boolean[] }) {
  return (
    <div className="rush-results" style={{ marginTop: 10 }}>
      {results.map((r, i) => (
        <span key={i} style={{ background: r ? 'var(--good)' : 'var(--bad)' }} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ themed puzzle set */

function PuzzleSetRunner() {
  const location = useLocation();
  const navigate = useNavigate();
  const spec = (location.state as PuzzleSetSpec | null) ?? {
    themes: ['fork', 'pin', 'hangingPiece', 'mateIn1'],
    count: 10,
    ratingOffset: 0,
    mode: 'train-focus',
  };
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [results, setResults] = useState<boolean[]>([]);
  const [rating, setRating] = useState<number | null>(null);
  const [startRating, setStartRating] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState('');
  const seen = useRef(new Set<string>());

  const next = useCallback(async () => {
    setAnswered(false);
    try {
      const r = await getSetting('puzzleRating', DEFAULT_RATING);
      setRating((cur) => cur ?? r.r);
      setStartRating((cur) => cur ?? r.r);
      const base = r.rd > 110 && spec.provisionalCap ? Math.min(r.r, spec.provisionalCap) : r.r;
      const target = Math.max(400, base + spec.ratingOffset);
      const p = await themedPuzzleNear(spec.themes, target, seen.current, spec.minRating ?? 0);
      seen.current.add(p.id);
      setPuzzle(p);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [spec.themes, spec.ratingOffset, spec.minRating, spec.provisionalCap]);

  useEffect(() => {
    void next();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (finished && spec.task) void markDone(spec.task);
  }, [finished, spec.task]);

  if (error) return <div className="panel error">{error}</div>;
  if (finished) {
    const solved = results.filter(Boolean).length;
    const delta = rating !== null && startRating !== null ? Math.round(rating - startRating) : 0;
    return (
      <div className="panel" style={{ maxWidth: 560 }}>
        <h1>Set complete</h1>
        <p className="muted">{themeLabel(spec.themes)}</p>
        <div className="rating-big">
          {solved} / {results.length}
          <span className={`delta ${delta >= 0 ? 'up' : 'down'}`}>{delta >= 0 ? `+${delta}` : delta} rating</span>
        </div>
        <Results results={results} />
        <p className="muted small" style={{ marginTop: 12 }}>Missed puzzles were added to your mistake trainer. They’ll come back in a few days.</p>
        <div className="btn-row" style={{ marginTop: 14 }}>
          <button className="btn primary" onClick={() => navigate('/')}>Back to today’s plan</button>
        </div>
      </div>
    );
  }
  if (!puzzle) return <div className="page-loading">Finding puzzles…</div>;

  const title = spec.task === 'warmup' ? 'Warm-up' : 'Focus puzzles';
  return (
    <PuzzlePlayer
      key={puzzle.id}
      puzzle={puzzle}
      onResult={async (o) => {
        const { after } = await recordRatedAttempt(puzzle, spec.mode, o === 'solved');
        setRating(after.r);
        setResults((r) => [...r, o === 'solved']);
        setAnswered(true);
      }}
      onNext={() => (results.length >= spec.count ? setFinished(true) : void next())}
      sidebar={
        <div className="panel">
          <div className="stat-row">
            <div>
              <div className="stat-label">{title}</div>
              <div className="stat">
                {Math.min(results.length + (answered ? 0 : 1), spec.count)}
                <span className="muted" style={{ fontSize: '1rem' }}> / {spec.count}</span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="stat-label">Rating</div>
              <div className="stat">{rating !== null ? Math.round(rating) : '…'}</div>
            </div>
          </div>
          <div className="muted small" style={{ marginTop: 6 }}>{themeLabel(spec.themes)}</div>
          <Results results={results} />
          <div style={{ marginTop: 10 }}><BackToPlan /></div>
        </div>
      }
    />
  );
}

/* ------------------------------------------------------------------ mistake trainer */

function MistakeRunner() {
  const location = useLocation();
  const navigate = useNavigate();
  const limit = (location.state as { limit?: number } | null)?.limit ?? 15;
  const [cards, setCards] = useState<MistakeCard[] | null>(null);
  const [i, setI] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);

  useEffect(() => {
    void dueMistakes(limit).then((c) => setCards(c.sort(() => Math.random() - 0.5)));
  }, [limit]);

  const done = cards !== null && i >= cards.length;
  useEffect(() => {
    if (done && cards && cards.length) void markDone('mistakes');
  }, [done, cards]);

  if (!cards) return <div className="page-loading">Loading…</div>;
  if (done) {
    return (
      <div className="panel" style={{ maxWidth: 560 }}>
        <h1>{cards.length ? 'Mistakes reviewed' : 'Nothing due'}</h1>
        {cards.length > 0 ? (
          <>
            <div className="rating-big">{results.filter(Boolean).length} / {results.length}<span className="muted small"> right first time</span></div>
            <Results results={results} />
            <p className="muted small" style={{ marginTop: 12 }}>Positions you got right come back less often; misses return tomorrow.</p>
          </>
        ) : (
          <p className="muted">Play and review games, or solve puzzles. Anything you get wrong lands here.</p>
        )}
        <button className="btn primary" style={{ marginTop: 10 }} onClick={() => navigate('/')}>Back to today’s plan</button>
      </div>
    );
  }

  const card = cards[i];
  const onGraded = async (ok: boolean) => {
    await gradeMistake(card, ok);
    setResults((r) => [...r, ok]);
  };
  const sidebar = (
    <div className="panel">
      <div className="stat-label">Mistake trainer</div>
      <div className="stat">{i + 1}<span className="muted" style={{ fontSize: '1rem' }}> / {cards.length}</span></div>
      <Results results={results} />
      <div style={{ marginTop: 10 }}><BackToPlan /></div>
    </div>
  );

  if (card.source === 'puzzle' && card.puzzle) {
    return (
      <PuzzlePlayer
        key={card.id}
        puzzle={card.puzzle}
        onResult={(o) => void onGraded(o === 'solved')}
        onNext={() => setI(i + 1)}
        sidebar={
          <>
            {sidebar}
            <div className="feedback info">A puzzle you missed before. Rated {card.puzzle.rating}.</div>
          </>
        }
      />
    );
  }
  return <GameMistake key={card.id} card={card} sidebar={sidebar} onGraded={onGraded} onNext={() => setI(i + 1)} />;
}

function GameMistake({
  card,
  sidebar,
  onGraded,
  onNext,
}: {
  card: MistakeCard;
  sidebar: React.ReactNode;
  onGraded: (ok: boolean) => Promise<void>;
  onNext: () => void;
}) {
  const fen = card.fen!;
  const color = fen.split(' ')[1] === 'w' ? 'white' : 'black';
  const [state, setState] = useState<'ask' | 'checking' | 'right' | 'wrong' | 'shown'>('ask');
  const [shownFen, setShownFen] = useState(fen);
  const [last, setLast] = useState<string | undefined>(card.lastUci);
  const [tries, setTries] = useState(0);
  const graded = useRef(false);

  const grade = async (ok: boolean) => {
    if (graded.current) return;
    graded.current = true;
    await onGraded(ok);
  };

  const onMove = async (u: string) => {
    if (state !== 'ask') return;
    const c = new Chess(fen);
    c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
    setShownFen(c.fen());
    setLast(u);
    let ok = u === card.bestUci || c.isCheckmate();
    if (!ok) {
      setState('checking');
      const r = await analysisEngine().analyze(c.fen(), { depth: 12 });
      const side = color === 'white' ? 'w' : 'b';
      const after = winPctFor(r.lines[0]?.score ?? { cp: 0 }, side);
      ok = (card.winBefore ?? 50) - after <= 3;
    }
    if (ok) {
      playMoveSound('success');
      setState('right');
      await grade(tries === 0);
    } else {
      playMoveSound('fail');
      setState('wrong');
      setTries((t) => t + 1);
      await grade(false);
      setTimeout(() => {
        setShownFen(fen);
        setLast(card.lastUci);
        setState('ask');
      }, 900);
    }
  };

  const reveal = async () => {
    await grade(false);
    const c = new Chess(fen);
    c.move({ from: card.bestUci!.slice(0, 2), to: card.bestUci!.slice(2, 4), promotion: card.bestUci![4] });
    setShownFen(c.fen());
    setLast(card.bestUci);
    setState('shown');
  };

  const meta = card.classification ? CLASS_META[card.classification as Classification] : undefined;
  return (
    <div className="board-layout">
      <Board
        fen={shownFen}
        orientation={color}
        movable={state === 'ask' ? color : undefined}
        onMove={(u) => void onMove(u)}
        lastMove={last}
        shapes={state === 'shown' && card.bestUci ? [arrow(card.bestUci, 'green')] : []}
      />
      <div className="side-col">
        {sidebar}
        <div className="panel">
          <div className="coach-box">
            {meta && <span className="class-dot" style={{ background: meta.color }}>{meta.glyph}</span>}
            <div>
              <div className="coach-title">From one of your games</div>
              <div className="small muted">
                You played <b>{card.playedSan}</b> here{meta ? ` (${meta.label.toLowerCase()})` : ''}. Find the better move for {color}.
              </div>
            </div>
          </div>
          {state === 'checking' && <div className="feedback info" style={{ marginTop: 10 }}>Checking…</div>}
          {state === 'wrong' && <div className="feedback bad" style={{ marginTop: 10 }}><X size={18} /> Not it. Try again.</div>}
          {(state === 'right' || state === 'shown') && (
            <div className={`feedback ${state === 'right' ? 'ok' : 'info'}`} style={{ marginTop: 10 }}>
              {state === 'right' ? <Check size={18} /> : <Eye size={18} />}
              <div>
                {state === 'right' ? 'Correct! ' : `The move was ${card.bestSan}. `}
                <span style={{ fontWeight: 500 }}>{card.explanation}</span>
              </div>
            </div>
          )}
          <div className="btn-row" style={{ marginTop: 10 }}>
            {state === 'right' || state === 'shown' ? (
              <button className="btn primary" onClick={onNext}>Next →</button>
            ) : (
              <button className="btn" onClick={() => void reveal()} disabled={state === 'checking'}><Eye size={16} /> Show move</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
