import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Brain,
  Check,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock,
  Flame,
  Lock,
  Play,
  Puzzle,
  RotateCcw,
  ScanSearch,
  Swords,
  Target,
  type LucideIcon,
} from 'lucide-react';
import { db, today } from '../db/db';
import { useSettings } from '../lib/settings';
import { estimateStrength, evaluateStages, loadSnapshot, type ReqStatus, type StageStatus } from '../features/path/progress';
import { buildPlan, DAILY_OPTIONS, streak, todaysBotGames, type Task, type TaskId } from '../features/path/daily';
import { GOAL_RATING, STAGES } from '../features/path/stages';

const TASK_ICON: Record<TaskId, LucideIcon> = {
  warmup: Flame,
  mistakes: RotateCcw,
  lesson: BookOpen,
  focus: Target,
  game: Swords,
  review: ScanSearch,
};

interface Data {
  stages: StageStatus[];
  current: StageStatus;
  strength: number;
  plan: Task[];
  streak: number;
  dueMistakes: number;
  totalMistakes: number;
  fresh: boolean;
}

export default function Home() {
  const navigate = useNavigate();
  const { dailyMinutes, update, loaded } = useSettings();
  const [d, setD] = useState<Data | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    if (!loaded) return;
    void (async () => {
      const snapshot = await loadSnapshot();
      const { stages, current } = evaluateStages(snapshot);
      const [log, due, total, st] = await Promise.all([
        db.dailyLog.get(today()),
        db.mistakes.where('due').belowOrEqual(Date.now()).count(),
        db.mistakes.count(),
        streak(),
      ]);
      const todays = todaysBotGames(snapshot)[0];
      const todaysGameReviewed = todays ? !!(await db.reviews.get(todays.id!)) : false;
      const plan = buildPlan({ snapshot, current, minutes: dailyMinutes, log, dueMistakes: due, todaysGameReviewed });
      const fresh = snapshot.attempts.length === 0 && snapshot.lessonsDone.size === 0 && snapshot.botGames.length === 0;
      setD({ stages, current, strength: estimateStrength(snapshot, current), plan, streak: st, dueMistakes: due, totalMistakes: total, fresh });
    })();
  }, [dailyMinutes, loaded]);

  if (!d) return <div className="page-loading">Loading your plan…</div>;
  const { current } = d;
  const doneCount = d.plan.filter((t) => t.done).length;
  const minutesLeft = d.plan.filter((t) => !t.done).reduce((a, t) => a + t.minutes, 0);
  const nextTask = d.plan.find((t) => !t.done);
  const pct = Math.max(0, Math.min(100, ((d.strength - 200) / (GOAL_RATING - 200)) * 100));
  const go = (link: string, state?: unknown) => navigate(link, { state });

  return (
    <div style={{ maxWidth: 1100 }}>
      {/* ---------------------------------------------------------------- road to 1000 */}
      <section className="hero-card" style={{ display: 'block' }}>
        <div className="stat-row" style={{ position: 'relative', flexWrap: 'wrap' }}>
          <div>
            <div className="stat-label">Road to {GOAL_RATING} · Stage {current.index + 1} of {STAGES.length}</div>
            <h1 style={{ margin: '2px 0 6px' }}>{current.stage.title}</h1>
            <p>{current.stage.focus}</p>
          </div>
          <div className="btn-row" style={{ gap: 22, alignItems: 'flex-end' }}>
            <div style={{ textAlign: 'right' }}>
              <div className="stat-label" title="Rough estimate from bots beaten, puzzle rating and roadmap progress">Est. strength</div>
              <div className="stat">≈ {d.strength}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="stat-label">Streak</div>
              <div className="stat" style={{ color: d.streak ? 'var(--accent-2)' : undefined }}>
                <Flame size={22} style={{ verticalAlign: -2 }} /> {d.streak}
              </div>
            </div>
          </div>
        </div>
        <div style={{ position: 'relative', marginTop: 18 }}>
          <div className="progress" style={{ height: 10 }}>
            <div style={{ width: `${pct}%` }} />
          </div>
          <div className="btn-row muted small" style={{ justifyContent: 'space-between', marginTop: 6 }}>
            {STAGES.map((s, i) => (
              <span key={s.id} style={{ color: i < current.index ? 'var(--accent-2)' : i === current.index ? 'var(--text)' : undefined, fontWeight: i === current.index ? 700 : 500 }}>
                {s.from}
              </span>
            ))}
            <span>{GOAL_RATING}</span>
          </div>
        </div>
        <span className="hero-art" aria-hidden>♞</span>
      </section>

      {d.fresh && (
        <div className="feedback info" style={{ marginBottom: 16, fontWeight: 450 }}>
          <Brain size={20} />
          <div>
            <b>How this works.</b> Each day, do the plan below: puzzles to build pattern recognition, a short lesson, one slow
            game against a bot at your level, and a review of that game. Everything you get wrong comes back as practice
            until it sticks. Each stage ends when you’ve shown the skill, not after a fixed time. If you already know
            the basics, the early stages will go by quickly.
          </div>
        </div>
      )}

      <div className="board-layout" style={{ alignItems: 'stretch' }}>
        {/* -------------------------------------------------------------- today's plan */}
        <section className="panel" style={{ flex: '1 1 420px' }}>
          <div className="panel-title">
            <h2>Today’s plan</h2>
            <div className="tabs" style={{ margin: 0, padding: 3 }}>
              {DAILY_OPTIONS.map((m) => (
                <button key={m} className={`tab ${dailyMinutes === m ? 'active' : ''}`} style={{ padding: '4px 10px' }} onClick={() => update({ dailyMinutes: m })}>
                  {m}m
                </button>
              ))}
            </div>
          </div>
          <div className="muted small" style={{ marginBottom: 12 }}>
            {doneCount === d.plan.length ? 'All done for today. Great work!' : `${doneCount} of ${d.plan.length} done · about ${minutesLeft} min left`}
          </div>
          <div className="plan-list">
            {d.plan.map((t) => {
              const Icon = TASK_ICON[t.id];
              const isNext = t === nextTask;
              return (
                <button key={t.id} className={`plan-item ${t.done ? 'done' : ''} ${isNext ? 'next' : ''}`} onClick={() => go(t.link, t.linkState)}>
                  <span className="plan-check">{t.done ? <Check size={15} strokeWidth={3} /> : <Icon size={17} />}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="plan-title">{t.title}</span>
                    <span className="plan-detail">{t.detail}</span>
                  </span>
                  <span className="plan-time"><Clock size={13} /> {t.minutes}m</span>
                  {isNext ? <span className="btn primary small"><Play size={14} /> Start</span> : <ChevronRight size={17} className="muted" />}
                </button>
              );
            })}
          </div>
          <div className="muted small" style={{ marginTop: 12 }}>
            Mistake trainer: {d.dueMistakes} due · {d.totalMistakes} saved positions
          </div>
        </section>

        {/* -------------------------------------------------------------- stage gates */}
        <section className="panel" style={{ flex: '1 1 380px' }}>
          <div className="panel-title">
            <h2>Stage goals</h2>
            <span className="tag accent">{Math.round(current.progress * 100)}%</span>
          </div>
          <p className="muted small" style={{ marginTop: 0 }}>{current.stage.why}</p>
          <ReqList reqs={current.reqs} go={go} />
        </section>
      </div>

      {/* ---------------------------------------------------------------- roadmap */}
      <div className="section-title">Roadmap</div>
      <div className="roadmap">
        {d.stages.map((st) => {
          const isCurrent = st === current;
          const locked = st.index > current.index;
          const expanded = open === st.stage.id;
          return (
            <div key={st.stage.id} className={`road-stage ${st.done ? 'done' : ''} ${isCurrent ? 'current' : ''} ${locked ? 'locked' : ''}`}>
              <button className="road-head" onClick={() => setOpen(expanded ? null : st.stage.id)}>
                <span className="road-dot">{st.done ? <Check size={15} strokeWidth={3} /> : locked ? <Lock size={13} /> : st.index + 1}</span>
                <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                  <span className="plan-title">{st.stage.title}</span>
                  <span className="plan-detail">{st.stage.from}–{st.stage.to} · {st.stage.focus}</span>
                </span>
                <span className="road-bar"><span style={{ width: `${st.progress * 100}%` }} /></span>
                {expanded ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
              </button>
              {expanded && (
                <div style={{ padding: '4px 14px 14px 52px' }}>
                  <p className="muted small" style={{ marginTop: 0 }}>{st.stage.why}</p>
                  <ReqList reqs={st.reqs} go={go} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid" style={{ marginTop: 18 }}>
        <button className="card" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => go('/train/mistakes', { limit: 20 })}>
          <span className="card-icon"><RotateCcw size={18} /></span>
          <div className="card-title">Mistake trainer</div>
          <div className="muted small">{d.dueMistakes} due now. Re-solve positions you got wrong.</div>
        </button>
        <button className="card" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => go('/puzzles/rush')}>
          <span className="card-icon"><Puzzle size={18} /></span>
          <div className="card-title">Puzzle Rush</div>
          <div className="muted small">Three minutes, three strikes. Builds speed.</div>
        </button>
        <button className="card" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => go('/review')}>
          <span className="card-icon"><ScanSearch size={18} /></span>
          <div className="card-title">Review an outside game</div>
          <div className="muted small">Paste a PGN from any site. Your mistakes join the trainer.</div>
        </button>
      </div>
    </div>
  );
}

function ReqList({ reqs, go }: { reqs: ReqStatus[]; go: (link: string, state?: unknown) => void }) {
  return (
    <div className="req-list">
      {reqs.map((r, i) => (
        <button key={i} className={`req ${r.done ? 'done' : ''}`} onClick={() => go(r.link, r.linkState)}>
          <span className="req-icon">{r.done ? <Check size={14} strokeWidth={3} /> : <Circle size={12} />}</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className="plan-title">{r.label}</span>
            <span className="plan-detail">{r.detail}</span>
            {!r.done && r.progress > 0 && (
              <span className="road-bar" style={{ display: 'block', width: '100%', marginTop: 6 }}>
                <span style={{ width: `${r.progress * 100}%` }} />
              </span>
            )}
          </span>
          {!r.done && <ChevronRight size={16} className="muted" />}
        </button>
      ))}
    </div>
  );
}
