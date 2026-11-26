import { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { db, getSetting, setSetting, type PuzzleAttempt } from '../db/db';
import { DEFAULT_RATING, updateRating, type Rating } from '../features/puzzles/glicko';
import { loadIndex, puzzleNear, themePuzzles, THEME_NAMES, type Puzzle, type PuzzleIndex } from '../features/puzzles/data';
import { PuzzlePlayer, type PuzzleOutcome } from '../features/puzzles/PuzzlePlayer';
import { PageHeader } from '../components/ui';
import { recordAttempt } from '../features/puzzles/record';
import { History as HistoryIcon, LayoutGrid, Shield, Target, Timer } from 'lucide-react';

export default function Puzzles() {
  return (
    <div>
      <PageHeader title="Puzzles" subtitle="Tactics from real games, picked to match your level." />
      <div className="tabs">
        {(
          [
            ['', 'Rated', Target],
            ['themes', 'Themes', LayoutGrid],
            ['rush', 'Rush', Timer],
            ['survival', 'Survival', Shield],
            ['history', 'History', HistoryIcon],
          ] as const
        ).map(([to, label, Icon]) => (
          <NavLink key={to} to={to ? `/puzzles/${to}` : '/puzzles'} end={to === ''} className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}>
            <Icon size={15} /> {label}
          </NavLink>
        ))}
      </div>
      <Routes>
        <Route index element={<Rated />} />
        <Route path="themes" element={<Themes />} />
        <Route path="themes/:theme" element={<ThemeTrainer />} />
        <Route path="rush" element={<Streak mode="rush" />} />
        <Route path="survival" element={<Streak mode="survival" />} />
        <Route path="history" element={<History />} />
      </Routes>
    </div>
  );
}

export async function getPuzzleRating(): Promise<Rating> {
  return getSetting('puzzleRating', DEFAULT_RATING);
}

function DataError({ error }: { error: string }) {
  return (
    <div className="panel">
      <h2>Puzzle data not found</h2>
      <p className="error">{error}</p>
      <p className="muted small">
        Puzzles come from the Lichess open database (CC0). Build them once with <code>npm run build:puzzles</code>.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ rated */

function Rated() {
  const [rating, setRating] = useState<Rating | null>(null);
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [delta, setDelta] = useState<number | null>(null);
  const [error, setError] = useState('');
  const seen = useRef(new Set<string>());

  const next = useCallback(async (r: Rating) => {
    setDelta(null);
    try {
      const p = await puzzleNear(r.r, seen.current);
      seen.current.add(p.id);
      setPuzzle(p);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const r = await getPuzzleRating();
      const recent = await db.puzzleAttempts.orderBy('at').reverse().limit(500).toArray();
      recent.forEach((a) => seen.current.add(a.puzzleId));
      setRating(r);
      void next(r);
    })();
  }, [next]);

  const onResult = async (o: PuzzleOutcome) => {
    if (!rating || !puzzle) return;
    const updated = updateRating(rating, { r: puzzle.rating, rd: 80 }, o === 'solved' ? 1 : 0);
    setDelta(Math.round(updated.r) - Math.round(rating.r));
    setRating(updated);
    await setSetting('puzzleRating', updated);
    await recordAttempt(puzzle, 'rated', o === 'solved', updated.r);
  };

  if (error) return <DataError error={error} />;
  if (!puzzle || !rating) return <div className="page-loading">Loading puzzles…</div>;
  return (
    <PuzzlePlayer
      key={puzzle.id}
      puzzle={puzzle}
      onResult={(o) => void onResult(o)}
      onNext={() => void next(rating)}
      sidebar={
        <div className="panel">
          <div className="stat-label">Puzzle rating{rating.rd > 110 ? ' (provisional)' : ''}</div>
          <div className="rating-big">
            {Math.round(rating.r)}{' '}
            {delta !== null && <span className={`delta small ${delta >= 0 ? 'up' : 'down'}`}>{delta >= 0 ? `+${delta}` : delta}</span>}
          </div>
        </div>
      }
    />
  );
}

/* ------------------------------------------------------------------ themes */

function Themes() {
  const [idx, setIdx] = useState<PuzzleIndex | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    loadIndex().then(setIdx, (e) => setError(e.message));
  }, []);
  if (error) return <DataError error={error} />;
  if (!idx) return <div className="page-loading">Loading…</div>;
  return (
    <div>
      <p className="muted">Practise one tactical idea at a time. Puzzles are picked near your rating.</p>
      <div className="grid">
        {idx.themes.map((t) => (
          <NavLink key={t.id} to={`/puzzles/themes/${t.id}`} className="card">
            <div style={{ fontWeight: 700 }}>{THEME_NAMES[t.id] ?? t.id}</div>
            <div className="muted small">{t.count} puzzles</div>
          </NavLink>
        ))}
      </div>
    </div>
  );
}

function ThemeTrainer() {
  const { theme = '' } = useParams();
  const navigate = useNavigate();
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [stats, setStats] = useState({ solved: 0, failed: 0 });
  const [error, setError] = useState('');
  const seen = useRef(new Set<string>());

  const next = useCallback(async () => {
    try {
      const [list, rating] = await Promise.all([themePuzzles(theme), getPuzzleRating()]);
      const near = list.filter((p) => !seen.current.has(p.id) && Math.abs(p.rating - rating.r) < 250);
      const pool = near.length ? near : list.filter((p) => !seen.current.has(p.id));
      const p = pool[Math.floor(Math.random() * pool.length)];
      if (!p) return setError('You have seen every puzzle in this theme.');
      seen.current.add(p.id);
      setPuzzle(p);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [theme]);
  useEffect(() => {
    void next();
  }, [next]);

  if (error) return <DataError error={error} />;
  if (!puzzle) return <div className="page-loading">Loading…</div>;
  return (
    <PuzzlePlayer
      key={puzzle.id}
      puzzle={puzzle}
      onResult={(o) => {
        setStats((s) => (o === 'solved' ? { ...s, solved: s.solved + 1 } : { ...s, failed: s.failed + 1 }));
        void recordAttempt(puzzle, `theme:${theme}`, o === 'solved');
      }}
      onNext={() => void next()}
      sidebar={
        <div className="panel">
          <h2>{THEME_NAMES[theme] ?? theme}</h2>
          <div className="muted small">
            Solved {stats.solved} · Missed {stats.failed}
          </div>
          <button className="btn small ghost" style={{ marginTop: 8 }} onClick={() => navigate('/puzzles/themes')}>
            ← All themes
          </button>
        </div>
      }
    />
  );
}

/* ------------------------------------------------------------------ rush / survival */

const RUSH_MS = 3 * 60 * 1000;

function Streak({ mode }: { mode: 'rush' | 'survival' }) {
  const [phase, setPhase] = useState<'idle' | 'running' | 'over'>('idle');
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [results, setResults] = useState<boolean[]>([]);
  const [deadline, setDeadline] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [best, setBest] = useState(0);
  const [error, setError] = useState('');
  const seen = useRef(new Set<string>());
  const key = `best-${mode}`;

  useEffect(() => {
    void getSetting(key, 0).then(setBest);
  }, [key]);

  const solved = results.filter(Boolean).length;
  const strikes = results.filter((r) => !r).length;

  const load = useCallback(async (solvedSoFar: number) => {
    try {
      // Difficulty ramps from ~600 by ~60 per solved puzzle.
      const p = await puzzleNear(600 + solvedSoFar * 60, seen.current);
      seen.current.add(p.id);
      setPuzzle(p);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const end = useCallback(
    async (finalSolved: number) => {
      setPhase('over');
      if (finalSolved > best) {
        setBest(finalSolved);
        await setSetting(key, finalSolved);
      }
    },
    [best, key],
  );

  useEffect(() => {
    if (phase !== 'running' || mode !== 'rush') return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= deadline) void end(solved);
    }, 250);
    return () => clearInterval(id);
  }, [phase, mode, deadline, end, solved]);

  const start = () => {
    setResults([]);
    setPhase('running');
    setDeadline(Date.now() + RUSH_MS);
    setNow(Date.now());
    void load(0);
  };

  const onResult = (o: PuzzleOutcome) => {
    const r = [...results, o === 'solved'];
    setResults(r);
    const s = r.filter(Boolean).length;
    if (puzzle) void recordAttempt(puzzle, mode, o === 'solved');
    if (r.filter((x) => !x).length >= 3) {
      void end(s);
      return;
    }
    // Move on quickly in streak modes.
    setTimeout(() => void load(s), o === 'solved' ? 500 : 900);
  };

  if (error) return <DataError error={error} />;
  const title = mode === 'rush' ? 'Puzzle Rush' : 'Survival';
  const rules = mode === 'rush' ? '3 minutes, 3 strikes. Puzzles get harder as you go.' : 'No clock, but 3 strikes and you’re out. How far can you get?';

  if (phase === 'idle' || phase === 'over' || !puzzle) {
    return (
      <div className="panel" style={{ maxWidth: 520 }}>
        <h1>{title}</h1>
        <p className="muted">{rules}</p>
        {phase === 'over' && (
          <>
            <div className="rating-big">{solved} solved</div>
            <ResultsStrip results={results} />
          </>
        )}
        <p className="muted small">Best: {best}</p>
        <button className="btn primary" onClick={start}>{phase === 'over' ? 'Play again' : 'Start'}</button>
      </div>
    );
  }

  const left = Math.max(0, deadline - now);
  return (
    <PuzzlePlayer
      key={puzzle.id}
      puzzle={puzzle}
      allowRetry={false}
      onResult={onResult}
      sidebar={
        <div className="panel">
          <div className="btn-row" style={{ justifyContent: 'space-between' }}>
            <div>
              <div className="stat-label">{title}</div>
              <div className="rating-big">{solved}</div>
            </div>
            {mode === 'rush' && (
              <div className="rating-big" style={{ color: left < 20000 ? '#ff9a9a' : undefined }}>
                {Math.floor(left / 60000)}:{String(Math.floor((left % 60000) / 1000)).padStart(2, '0')}
              </div>
            )}
          </div>
          <div className="strikes" style={{ marginTop: 8 }}>
            {[0, 1, 2].map((i) => (
              <span key={i} className={`strike ${i < strikes ? 'on' : ''}`} />
            ))}
          </div>
          <ResultsStrip results={results} />
        </div>
      }
    />
  );
}

function ResultsStrip({ results }: { results: boolean[] }) {
  return (
    <div className="rush-results" style={{ marginTop: 8 }}>
      {results.map((r, i) => (
        <span key={i} style={{ background: r ? 'var(--good)' : 'var(--bad)' }} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ history */

function History() {
  const [rows, setRows] = useState<PuzzleAttempt[]>([]);
  useEffect(() => {
    void db.puzzleAttempts.orderBy('at').reverse().limit(200).toArray().then(setRows);
  }, []);
  const rated = rows.filter((r) => r.mode === 'rated');
  const pct = rows.length ? Math.round((rows.filter((r) => r.solved).length / rows.length) * 100) : 0;
  return (
    <div style={{ maxWidth: 760 }}>
      <div className="grid" style={{ marginBottom: 14 }}>
        <div className="card">
          <div className="stat">{rows.length}</div>
          <div className="stat-label">recent attempts</div>
        </div>
        <div className="card">
          <div className="stat">{pct}%</div>
          <div className="stat-label">solved</div>
        </div>
        <div className="card">
          <div className="stat">{rated[0] ? Math.round(rated[0].userRatingAfter) : '-'}</div>
          <div className="stat-label">current rating</div>
        </div>
      </div>
      {rated.length > 1 && <RatingSpark values={rated.map((r) => r.userRatingAfter).reverse()} />}
      <div className="game-list" style={{ marginTop: 12 }}>
        {rows.map((r) => (
          <div key={r.id} className="game-row" style={{ cursor: 'default' }}>
            <span>
              <span className={r.solved ? 'check' : 'error'}>{r.solved ? '✓' : '✗'}</span> Puzzle {r.puzzleId}{' '}
              <span className="muted small">· {r.rating} · {r.mode}</span>
            </span>
            <span className="muted small">{new Date(r.at).toLocaleString()}</span>
          </div>
        ))}
        {!rows.length && <div className="empty">No puzzles attempted yet.</div>}
      </div>
    </div>
  );
}

export function RatingSpark({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const min = Math.min(...values) - 20;
  const max = Math.max(...values) + 20;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 300},${60 - ((v - min) / (max - min)) * 56 - 2}`).join(' ');
  return (
    <svg className="spark" viewBox="0 0 300 60" preserveAspectRatio="none" role="img" aria-label="Rating trend">
      <polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
