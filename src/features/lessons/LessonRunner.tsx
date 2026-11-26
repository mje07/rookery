import { useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { Board, arrow } from '../../components/Board';
import { analysisEngine, botEngine } from '../../engine/EngineService';
import { winPctFor } from '../../chess/evalMath';
import { playMoveSound } from '../../lib/sound';
import { RichText } from './RichText';
import type { Lesson, MoveStep, PlayStep, QuizStep, Step } from './types';

interface Props {
  lesson: Lesson;
  startAt?: number;
  onProgress: (completedSteps: number, done: boolean) => void;
  onExit: () => void;
}

const orientationOf = (s: Step): 'white' | 'black' =>
  s.orientation ?? (s.fen && s.type !== 'text' && s.type !== 'quiz' && s.fen.split(' ')[1] === 'b' ? 'black' : 'white');

export function LessonRunner({ lesson, startAt = 0, onProgress, onExit }: Props) {
  const [idx, setIdx] = useState(Math.min(startAt, lesson.steps.length - 1));
  const [done, setDone] = useState(false);
  const step = lesson.steps[idx];
  const [complete, setComplete] = useState(step.type === 'text');

  const goto = (i: number) => {
    setIdx(i);
    setComplete(lesson.steps[i].type === 'text');
  };
  const next = () => {
    if (idx + 1 >= lesson.steps.length) {
      setDone(true);
      onProgress(lesson.steps.length, true);
    } else {
      onProgress(idx + 1, false);
      goto(idx + 1);
    }
  };

  if (done) {
    return (
      <div className="panel" style={{ maxWidth: 560 }}>
        <h1>Lesson complete 🎉</h1>
        <p className="muted">{lesson.title}</p>
        <div className="btn-row">
          <button className="btn primary" onClick={onExit}>Continue</button>
          <button className="btn" onClick={() => { setDone(false); goto(0); }}>Restart</button>
        </div>
      </div>
    );
  }

  return (
    <StepView
      key={`${lesson.id}-${idx}`}
      step={step}
      header={
        <div className="panel">
          <div className="btn-row" style={{ justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0 }}>{lesson.title}</h2>
            <span className="muted small">{idx + 1} / {lesson.steps.length}</span>
          </div>
          <div className="lesson-steps" style={{ marginTop: 10 }}>
            {lesson.steps.map((_, i) => (
              <span key={i} className={i < idx ? 'done' : i === idx ? 'cur' : ''} />
            ))}
          </div>
        </div>
      }
      footer={
        <div className="btn-row">
          <button className="btn" onClick={() => goto(idx - 1)} disabled={idx === 0}>◀ Back</button>
          <button className="btn primary" onClick={next} disabled={!complete}>
            {idx + 1 >= lesson.steps.length ? 'Finish' : 'Next ▶'}
          </button>
          {!complete && step.type !== 'text' && (
            <button className="btn ghost small" onClick={() => setComplete(true)} title="Skip this exercise">Skip</button>
          )}
          <button className="btn ghost small" onClick={onExit}>Exit</button>
        </div>
      }
      onComplete={() => setComplete(true)}
    />
  );
}

interface StepViewProps {
  step: Step;
  header: React.ReactNode;
  footer: React.ReactNode;
  onComplete: () => void;
}

function StepView(p: StepViewProps) {
  switch (p.step.type) {
    case 'text':
      return <Layout {...p} fen={p.step.fen} />;
    case 'quiz':
      return <QuizView {...p} step={p.step} />;
    case 'move':
      return <MoveView {...p} step={p.step} />;
    case 'play':
      return <PlayView {...p} step={p.step} />;
  }
}

function Layout({
  step,
  header,
  footer,
  fen,
  children,
  board,
}: StepViewProps & { fen?: string; children?: React.ReactNode; board?: React.ReactNode }) {
  const shapes = useMemo(() => (step.arrows ?? []).map((a) => arrow(a.from + a.to, a.color ?? 'green')), [step.arrows]);
  const highlights = useMemo(() => Object.fromEntries((step.squares ?? []).map((s) => [s, 'sq-hint'])), [step.squares]);
  return (
    <div className="board-layout">
      {board ?? (fen ? <Board fen={fen} orientation={orientationOf(step)} shapes={shapes} highlights={highlights} /> : null)}
      <div className="side-col" style={{ maxWidth: fen || board ? 460 : 720 }}>
        {header}
        <div className="panel">
          <RichText text={step.text} />
          {children}
        </div>
        {footer}
      </div>
    </div>
  );
}

function QuizView(p: StepViewProps & { step: QuizStep }) {
  const [picked, setPicked] = useState<number | null>(null);
  const right = picked === p.step.answer;
  return (
    <Layout {...p} fen={p.step.fen}>
      <div style={{ fontWeight: 650, margin: '6px 0 8px' }}>{p.step.question}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {p.step.options.map((o, i) => (
          <button
            key={i}
            className={`btn quiz-opt ${picked === i ? (i === p.step.answer ? 'right' : 'wrong') : ''}`}
            disabled={right}
            onClick={() => {
              setPicked(i);
              if (i === p.step.answer) {
                playMoveSound('success');
                p.onComplete();
              } else playMoveSound('fail');
            }}
          >
            {o}
          </button>
        ))}
      </div>
      {picked !== null && (
        <div className={`feedback ${right ? 'ok' : 'bad'}`} style={{ marginTop: 10 }}>
          {right ? <RichText text={p.step.explain} /> : 'Not quite. Try again.'}
        </div>
      )}
    </Layout>
  );
}

function applyUci(fen: string, u: string) {
  const c = new Chess(fen);
  c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
  return c;
}

function MoveView(p: StepViewProps & { step: MoveStep }) {
  const { step } = p;
  const [fen, setFen] = useState(step.fen);
  const [k, setK] = useState(0); // index into solution of the next user move
  const [last, setLast] = useState<string | undefined>();
  const [status, setStatus] = useState<'play' | 'reply' | 'checking' | 'wrong' | 'done'>('play');
  const [hint, setHint] = useState(false);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const userColor = step.fen.split(' ')[1] === 'w' ? 'white' : 'black';

  const succeed = (c: Chess, u: string) => {
    setFen(c.fen());
    setLast(u);
    setStatus('done');
    playMoveSound('success');
    p.onComplete();
  };

  const onMove = async (u: string) => {
    if (status !== 'play') return;
    const expected = step.solution[k];
    const c = applyUci(fen, u);
    const isLast = k === step.solution.length - 1;
    let ok = u === expected || (k === 0 && (step.alts ?? []).includes(u));
    if (!ok && step.accept === 'mate' && isLast && c.isCheckmate()) ok = true;
    if (!ok && step.accept === 'engine') {
      setFen(c.fen());
      setLast(u);
      setStatus('checking');
      const mover = fen.split(' ')[1] as 'w' | 'b';
      const engine = analysisEngine();
      const [ref, got] = await Promise.all([
        engine.analyze(applyUci(fen, expected).fen(), { depth: 12 }),
        c.isGameOver() ? Promise.resolve(null) : engine.analyze(c.fen(), { depth: 12 }),
      ]);
      const refW = winPctFor(ref.lines[0]?.score ?? { cp: 0 }, mover);
      const gotW = c.isCheckmate() ? 100 : winPctFor(got?.lines[0]?.score ?? { cp: 0 }, mover);
      ok = gotW >= refW - 4;
      if (!ok) {
        setStatus('wrong');
        playMoveSound('fail');
        timers.current.push(window.setTimeout(() => { setFen(fen); setLast(undefined); setStatus('play'); }, 900));
        return;
      }
      return succeed(c, u);
    }
    if (!ok) {
      setFen(c.fen());
      setLast(u);
      setStatus('wrong');
      playMoveSound('fail');
      timers.current.push(window.setTimeout(() => { setFen(fen); setLast(k > 0 ? step.solution[k - 1] : undefined); setStatus('play'); }, 900));
      return;
    }
    setHint(false);
    if (isLast || c.isCheckmate()) return succeed(c, u);
    setFen(c.fen());
    setLast(u);
    setStatus('reply');
    const reply = step.solution[k + 1];
    timers.current.push(
      window.setTimeout(() => {
        const r = applyUci(c.fen(), reply);
        setFen(r.fen());
        setLast(reply);
        setK(k + 2);
        setStatus('play');
      }, 500),
    );
  };

  const expected = step.solution[k];
  const board = (
    <Board
      fen={fen}
      orientation={step.orientation ?? userColor}
      movable={status === 'play' ? userColor : undefined}
      onMove={(u) => void onMove(u)}
      lastMove={last}
      shapes={hint && status === 'play' ? [arrow(expected, 'blue')] : []}
      highlights={hint && status === 'play' ? { [expected.slice(0, 2)]: 'sq-hint' } : undefined}
    />
  );
  const msg =
    status === 'done'
      ? { cls: 'ok', text: step.success ?? 'Correct!' }
      : status === 'wrong'
        ? { cls: 'bad', text: 'Not quite. Try again.' }
        : status === 'checking'
          ? { cls: 'info', text: 'Checking…' }
          : null;
  return (
    <Layout {...p} board={board}>
      {msg && <div className={`feedback ${msg.cls}`} style={{ marginTop: 8 }}>{msg.text}</div>}
      {status !== 'done' && (
        <div className="btn-row" style={{ marginTop: 8 }}>
          {step.hint && <span className="muted small">{hint ? step.hint : ''}</span>}
          <button className="btn small" onClick={() => setHint(true)} disabled={hint}>Hint</button>
        </div>
      )}
    </Layout>
  );
}

function countQueens(fen: string, color: 'w' | 'b') {
  const board = fen.split(' ')[0];
  return [...board].filter((ch) => ch === (color === 'w' ? 'Q' : 'q')).length;
}

function PlayView(p: StepViewProps & { step: PlayStep }) {
  const { step } = p;
  const user = step.fen.split(' ')[1] as 'w' | 'b';
  const opp = user === 'w' ? 'b' : 'w';
  const [fen, setFen] = useState(step.fen);
  const [last, setLast] = useState<string | undefined>();
  const [moves, setMoves] = useState(0);
  const [status, setStatus] = useState<'play' | 'engine' | 'won' | 'failed'>('play');
  const [reason, setReason] = useState('');
  const baseQueens = useMemo(() => ({ user: countQueens(step.fen, user), opp: countQueens(step.fen, opp) }), [step.fen, user, opp]);
  const ctrl = useRef<AbortController | null>(null);
  useEffect(() => () => ctrl.current?.abort(), []);

  const fail = (why: string) => {
    setStatus('failed');
    setReason(why);
    playMoveSound('fail');
  };
  const win = () => {
    setStatus('won');
    playMoveSound('success');
    p.onComplete();
  };

  const onMove = async (u: string) => {
    if (status !== 'play') return;
    const c = applyUci(fen, u);
    const n = moves + 1;
    setFen(c.fen());
    setLast(u);
    setMoves(n);
    if (step.goal === 'mate' && c.isCheckmate()) return win();
    if (c.isStalemate()) return fail('Stalemate. The win slipped away.');
    if (c.isDraw()) return fail('The game is drawn.');
    if (step.goal !== 'hold' && n >= step.moves) return fail(`Out of moves (${step.moves}).`);
    // Engine reply at full strength.
    setStatus('engine');
    const ac = new AbortController();
    ctrl.current = ac;
    const r = await botEngine().analyze(c.fen(), { movetime: 400, signal: ac.signal });
    if (ac.signal.aborted || !r.bestMove) return;
    const after = applyUci(c.fen(), r.bestMove);
    setFen(after.fen());
    setLast(r.bestMove);
    if (after.isCheckmate()) return fail('You were checkmated.');
    if (step.goal === 'hold' && countQueens(after.fen(), opp) > baseQueens.opp) return fail('Your opponent promoted.');
    if (step.goal === 'queen' && countQueens(after.fen(), user) > baseQueens.user) return win();
    if (step.goal === 'queen' && after.isDraw()) return fail('The game is drawn.');
    if (step.goal === 'hold' && (after.isDraw() || n >= step.moves)) return win();
    setStatus('play');
  };

  const restart = () => {
    ctrl.current?.abort();
    setFen(step.fen);
    setLast(undefined);
    setMoves(0);
    setStatus('play');
    setReason('');
  };

  const color = user === 'w' ? 'white' : 'black';
  const board = <Board fen={fen} orientation={step.orientation ?? color} movable={status === 'play' ? color : undefined} onMove={(u) => void onMove(u)} lastMove={last} />;
  const goalText = step.goal === 'mate' ? 'Checkmate' : step.goal === 'queen' ? 'Promote and keep a queen' : `Survive ${step.moves} moves`;
  return (
    <Layout {...p} board={board}>
      <div className="muted small" style={{ marginTop: 6 }}>
        Goal: {goalText} · Moves: {moves}
        {step.goal !== 'hold' ? ` / ${step.moves}` : ''}
        {status === 'engine' && ' · engine thinking…'}
      </div>
      {status === 'won' && <div className="feedback ok" style={{ marginTop: 8 }}>{step.success ?? 'Goal reached!'}</div>}
      {status === 'failed' && (
        <div className="feedback bad" style={{ marginTop: 8 }}>
          {reason}{' '}
          <button className="btn small" onClick={restart}>Try again</button>
        </div>
      )}
      {(status === 'play' || status === 'engine') && moves > 0 && (
        <button className="btn small ghost" style={{ marginTop: 8 }} onClick={restart}>Restart</button>
      )}
    </Layout>
  );
}
