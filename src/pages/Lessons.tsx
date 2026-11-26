import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { db, type LessonProgress } from '../db/db';
import { CATEGORIES, LESSONS, lessonById } from '../content/lessons';
import { LessonRunner } from '../features/lessons/LessonRunner';
import { PageHeader } from '../components/ui';
import { Check, Compass, Crown, GitBranch, GraduationCap, Hourglass, Zap, type LucideIcon } from 'lucide-react';

const CATEGORY_ICON: Record<string, LucideIcon> = {
  Basics: GraduationCap,
  Tactics: Zap,
  'Checkmate patterns': Crown,
  Endgames: Hourglass,
  Openings: GitBranch,
  Strategy: Compass,
};

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
      <PageHeader
        title="Lessons"
        subtitle="Short interactive lessons: read the idea, then play it on the board."
        actions={
          <div style={{ minWidth: 220 }}>
            <div className="muted small" style={{ marginBottom: 6, textAlign: 'right' }}>{doneCount} of {LESSONS.length} complete</div>
            <div className="progress"><div style={{ width: `${(doneCount / LESSONS.length) * 100}%` }} /></div>
          </div>
        }
      />
      {CATEGORIES.map((cat) => (
        <div key={cat}>
          <div className="section-title">{cat}</div>
          <div className="grid">
            {LESSONS.filter((l) => l.category === cat).map((l) => {
              const p = progress.get(l.id);
              const pct = p ? (p.completed ? 100 : Math.round((p.completedSteps / l.steps.length) * 100)) : 0;
              return (
                <Link key={l.id} to={`/lessons/${l.id}`} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                  <div className="stat-row">
                    <span className="card-icon">{(() => { const I = CATEGORY_ICON[l.category] ?? GraduationCap; return <I size={18} />; })()}</span>
                    {p?.completed && <span className="done-badge" title="Completed"><Check size={14} strokeWidth={3} /></span>}
                  </div>
                  <div className="card-title">{l.title}</div>
                  <div className="muted small" style={{ lineHeight: 1.5, flex: 1 }}>{l.summary}</div>
                  <div className="btn-row" style={{ marginTop: 12, gap: 10 }}>
                    <div className="progress" style={{ height: 5, flex: 1 }}>
                      <div style={{ width: `${pct}%` }} />
                    </div>
                    <span className="muted small">{l.steps.length} steps</span>
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
