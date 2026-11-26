import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, Bot, Flame, GitBranch, Puzzle, ScanSearch } from 'lucide-react';
import { db, getSetting, type GameRecord } from '../db/db';
import { DEFAULT_RATING, type Rating } from '../features/puzzles/glicko';
import { LESSONS } from '../content/lessons';
import { RatingSpark } from './Puzzles';

interface Stats {
  rating: Rating;
  trend: number[];
  solvedToday: number;
  lessonsDone: number;
  nextLesson?: { id: string; title: string; category: string };
  dueCards: number;
  repertoires: number;
  recent: (GameRecord & { acc?: { w: number; b: number } })[];
  bestRush: number;
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default function Home() {
  const navigate = useNavigate();
  const [s, setS] = useState<Stats | null>(null);
  useEffect(() => {
    void (async () => {
      const [rating, attempts, progress, cards, reps, games, bestRush] = await Promise.all([
        getSetting('puzzleRating', DEFAULT_RATING),
        db.puzzleAttempts.orderBy('at').reverse().limit(300).toArray(),
        db.lessonProgress.toArray(),
        db.repCards.where('due').belowOrEqual(Date.now()).count(),
        db.repertoires.count(),
        db.games.orderBy('addedAt').reverse().limit(5).toArray(),
        getSetting('best-rush', 0),
      ]);
      const reviews = await db.reviews.bulkGet(games.map((g) => g.id!));
      const startOfDay = new Date().setHours(0, 0, 0, 0);
      const done = new Set(progress.filter((p) => p.completed).map((p) => p.lessonId));
      const next = LESSONS.find((l) => !done.has(l.id));
      setS({
        rating,
        trend: attempts.filter((a) => a.mode === 'rated').map((a) => a.userRatingAfter).reverse(),
        solvedToday: attempts.filter((a) => a.at >= startOfDay && a.solved).length,
        lessonsDone: done.size,
        nextLesson: next && { id: next.id, title: next.title, category: next.category },
        dueCards: cards,
        repertoires: reps,
        recent: games.map((g, i) => ({ ...g, acc: reviews[i]?.data.accuracy })),
        bestRush,
      });
    })();
  }, []);

  if (!s) return <div className="page-loading">Loading…</div>;
  const lessonPct = (s.lessonsDone / LESSONS.length) * 100;
  return (
    <div style={{ maxWidth: 1080 }}>
      <section className="hero-card">
        <div style={{ position: 'relative' }}>
          <h1>{greeting()}.</h1>
          <p>
            {s.dueCards > 0
              ? `You have ${s.dueCards} opening move${s.dueCards > 1 ? 's' : ''} to review today.`
              : s.nextLesson
                ? `Up next: “${s.nextLesson.title}”. Or warm up with a few puzzles.`
                : 'Warm up with a few puzzles, then play a game and review it.'}
          </p>
        </div>
        <div className="btn-row" style={{ position: 'relative' }}>
          <button className="btn primary" onClick={() => navigate('/puzzles')}><Puzzle size={17} /> Solve puzzles</button>
          <button className="btn" onClick={() => navigate('/review')}><ScanSearch size={17} /> Review a game</button>
        </div>
        <span className="hero-art" aria-hidden>♞</span>
      </section>

      <div className="grid">
        <Link to="/puzzles" className="card">
          <div className="stat-row">
            <div>
              <div className="stat-label">Puzzle rating</div>
              <div className="stat">{Math.round(s.rating.r)}</div>
            </div>
            <span className="card-icon" style={{ margin: 0 }}><Puzzle size={19} /></span>
          </div>
          <div className="muted small" style={{ marginTop: 4 }}>
            {s.solvedToday} solved today · <Flame size={13} style={{ verticalAlign: -2 }} /> Rush best {s.bestRush}
          </div>
          {s.trend.length > 1 && <RatingSpark values={s.trend.slice(-60)} />}
        </Link>
        <Link to={s.nextLesson ? `/lessons/${s.nextLesson.id}` : '/lessons'} className="card">
          <div className="stat-row">
            <div>
              <div className="stat-label">Lessons</div>
              <div className="stat">
                {s.lessonsDone}<span className="muted" style={{ fontSize: '1.1rem', fontWeight: 600 }}> / {LESSONS.length}</span>
              </div>
            </div>
            <span className="card-icon" style={{ margin: 0 }}><BookOpen size={19} /></span>
          </div>
          <div className="progress" style={{ margin: '10px 0 8px' }}>
            <div style={{ width: `${lessonPct}%` }} />
          </div>
          <div className="muted small">{s.nextLesson ? `Next: ${s.nextLesson.title}` : 'All lessons complete!'}</div>
        </Link>
        <Link to="/openings" className="card">
          <div className="stat-row">
            <div>
              <div className="stat-label">Openings due</div>
              <div className="stat" style={{ color: s.dueCards ? 'var(--accent-2)' : undefined }}>{s.dueCards}</div>
            </div>
            <span className="card-icon" style={{ margin: 0 }}><GitBranch size={19} /></span>
          </div>
          <div className="muted small" style={{ marginTop: 4 }}>
            {s.repertoires ? `${s.repertoires} repertoire${s.repertoires > 1 ? 's' : ''}` : 'Build your first repertoire'}
          </div>
        </Link>
        <Link to="/play" className="card">
          <div className="stat-row">
            <div>
              <div className="stat-label">Play</div>
              <div className="stat">9 bots</div>
            </div>
            <span className="card-icon" style={{ margin: 0 }}><Bot size={19} /></span>
          </div>
          <div className="muted small" style={{ marginTop: 4 }}>From total beginner to full engine strength.</div>
        </Link>
      </div>

      <div className="section-title">Recent games</div>
      {s.recent.length ? (
        <div className="game-list">
          {s.recent.map((g) => (
            <div key={g.id} className="game-row" onClick={() => navigate(`/review/${g.id}`)}>
              <span className="btn-row" style={{ gap: 10 }}>
                <span className="result-pill">{g.result}</span>
                <span><b>{g.white}</b> <span className="muted">vs</span> <b>{g.black}</b></span>
              </span>
              <span className="muted small">{g.acc ? `Accuracy ${g.acc.w.toFixed(1)} · ${g.acc.b.toFixed(1)}` : 'Not reviewed yet'}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty">
          No games yet. <Link to="/play">Play a bot</Link> or <Link to="/review">import a PGN</Link> to get your first review.
        </div>
      )}
    </div>
  );
}
