import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { db, getSetting, type GameRecord } from '../db/db';
import { DEFAULT_RATING, type Rating } from '../features/puzzles/glicko';
import { LESSONS } from '../content/lessons';
import { RatingSpark } from './Puzzles';

interface Stats {
  rating: Rating;
  trend: number[];
  solvedToday: number;
  lessonsDone: number;
  nextLesson?: { id: string; title: string };
  dueCards: number;
  repertoires: number;
  recent: (GameRecord & { acc?: { w: number; b: number } })[];
  bestRush: number;
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
        nextLesson: next && { id: next.id, title: next.title },
        dueCards: cards,
        repertoires: reps,
        recent: games.map((g, i) => ({ ...g, acc: reviews[i]?.data.accuracy })),
        bestRush,
      });
    })();
  }, []);

  if (!s) return <div className="page-loading">Loading…</div>;
  return (
    <div style={{ maxWidth: 1050 }}>
      <div className="hero">
        <div>
          <h1 style={{ marginBottom: 4 }}>Welcome back</h1>
          <div className="muted">Everything runs locally: your games, progress and the engine stay on this computer.</div>
        </div>
        <div className="btn-row">
          <button className="btn primary" onClick={() => navigate('/puzzles')}>Solve puzzles</button>
          <button className="btn" onClick={() => navigate('/review')}>Review a game</button>
        </div>
      </div>

      <div className="grid">
        <Link to="/puzzles" className="card">
          <div className="stat-label">Puzzle rating</div>
          <div className="stat">{Math.round(s.rating.r)}</div>
          <div className="muted small">{s.solvedToday} solved today · Rush best {s.bestRush}</div>
          {s.trend.length > 1 && <RatingSpark values={s.trend.slice(-60)} />}
        </Link>
        <Link to={s.nextLesson ? `/lessons/${s.nextLesson.id}` : '/lessons'} className="card">
          <div className="stat-label">Lessons</div>
          <div className="stat">{s.lessonsDone} / {LESSONS.length}</div>
          <div className="progress" style={{ margin: '6px 0' }}>
            <div style={{ width: `${(s.lessonsDone / LESSONS.length) * 100}%` }} />
          </div>
          <div className="muted small">{s.nextLesson ? `Next: ${s.nextLesson.title}` : 'All lessons complete!'}</div>
        </Link>
        <Link to="/openings" className="card">
          <div className="stat-label">Opening reviews due</div>
          <div className="stat" style={{ color: s.dueCards ? 'var(--accent)' : undefined }}>{s.dueCards}</div>
          <div className="muted small">{s.repertoires ? `${s.repertoires} repertoire${s.repertoires > 1 ? 's' : ''}` : 'Build your first repertoire'}</div>
        </Link>
        <Link to="/play" className="card">
          <div className="stat-label">Play</div>
          <div className="stat">♟</div>
          <div className="muted small">Nine bots from beginner to full engine strength.</div>
        </Link>
      </div>

      <div className="section-title">Recent games</div>
      {s.recent.length ? (
        <div className="game-list">
          {s.recent.map((g) => (
            <div key={g.id} className="game-row" onClick={() => navigate(`/review/${g.id}`)}>
              <span>
                <b>{g.white}</b> vs <b>{g.black}</b> <span className="muted">· {g.result}</span>
              </span>
              <span className="muted small">{g.acc ? `Accuracy ${g.acc.w.toFixed(1)} / ${g.acc.b.toFixed(1)}` : 'Not reviewed'}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty">
          No games yet. <Link to="/play">Play a bot</Link> or <Link to="/review">import a PGN</Link>.
        </div>
      )}
    </div>
  );
}
