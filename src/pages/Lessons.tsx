import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { db, type LessonProgress } from '../db/db';
import { CATEGORIES, LESSONS, lessonById } from '../content/lessons';
import { LessonRunner } from '../features/lessons/LessonRunner';

export default function Lessons() {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const [progress, setProgress] = useState<Map<string, LessonProgress>>(new Map());

  const refresh = useCallback(async () => {
    const all = await db.lessonProgress.toArray();
    setProgress(new Map(all.map((p) => [p.lessonId, p])));
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh, lessonId]);

  if (lessonId) {
    const lesson = lessonById(lessonId);
    if (!lesson) return <div className="empty">Lesson not found.</div>;
    const p = progress.get(lessonId);
    return (
      <LessonRunner
        key={lessonId}
        lesson={lesson}
        startAt={p && !p.completed ? p.completedSteps : 0}
        onProgress={(completedSteps, completed) => {
          const prev = progress.get(lessonId);
          void db.lessonProgress.put({
            lessonId,
            completedSteps: Math.max(completedSteps, prev?.completed ? lesson.steps.length : 0),
            completed: completed || !!prev?.completed,
            updatedAt: Date.now(),
          });
        }}
        onExit={() => navigate('/lessons')}
      />
    );
  }

  const doneCount = LESSONS.filter((l) => progress.get(l.id)?.completed).length;
  return (
    <div style={{ maxWidth: 1000 }}>
      <h1>Lessons</h1>
      <p className="muted">
        Short interactive lessons: read the idea, then play it on the board. {doneCount} / {LESSONS.length} complete.
      </p>
      <div className="progress" style={{ maxWidth: 320 }}>
        <div style={{ width: `${(doneCount / LESSONS.length) * 100}%` }} />
      </div>
      {CATEGORIES.map((cat) => (
        <div key={cat}>
          <div className="section-title">{cat}</div>
          <div className="grid">
            {LESSONS.filter((l) => l.category === cat).map((l) => {
              const p = progress.get(l.id);
              const pct = p ? (p.completed ? 100 : Math.round((p.completedSteps / l.steps.length) * 100)) : 0;
              return (
                <Link key={l.id} to={`/lessons/${l.id}`} className="card">
                  <div className="btn-row" style={{ justifyContent: 'space-between' }}>
                    <b>{l.title}</b>
                    {p?.completed && <span className="check">✓</span>}
                  </div>
                  <div className="muted small" style={{ margin: '4px 0 8px' }}>{l.summary}</div>
                  <div className="progress" style={{ height: 5 }}>
                    <div style={{ width: `${pct}%` }} />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
