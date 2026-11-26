import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { Board, arrow } from '../../components/Board';
import { playMoveSound } from '../../lib/sound';
import { THEME_NAMES, type Puzzle } from './data';

export type PuzzleOutcome = 'solved' | 'failed';

interface Props {
  puzzle: Puzzle;
  /** Called once, on the first mistake (failed) or on completion without mistakes (solved). */
  onResult: (outcome: PuzzleOutcome) => void;
  /** After a mistake, let the user keep trying (true) or stop (false, e.g. Rush). */
  allowRetry?: boolean;
  showControls?: boolean;
  onNext?: () => void;
  /** Extra content shown above the controls. */
  sidebar?: React.ReactNode;
}

interface State {
  fen: string;
  step: number; // index into puzzle.moves of the next expected move
  lastMove?: string;
  status: 'opponent' | 'play' | 'wrong' | 'done';
  failed: boolean;
}

function applyUci(fen: string, uci: string): string {
  const c = new Chess(fen);
  c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  return c.fen();
}

/** Plays through one puzzle: auto-plays the opponent's moves, checks the solver's. */
export function PuzzlePlayer({ puzzle, onResult, allowRetry = true, showControls = true, onNext, sidebar }: Props) {
  const [s, setS] = useState<State>({ fen: puzzle.fen, step: 0, status: 'opponent', failed: false });
  const [hint, setHint] = useState(0); // 0 none, 1 piece, 2 move
  const reported = useRef(false);
  const timers = useRef<number[]>([]);
  const solverColor = useMemo(() => (puzzle.fen.split(' ')[1] === 'w' ? 'black' : 'white'), [puzzle.fen]);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const report = useCallback(
    (o: PuzzleOutcome) => {
      if (reported.current) return;
      reported.current = true;
      onResult(o);
    },
    [onResult],
  );

  // Opening opponent move.
  useEffect(() => {
    if (s.status !== 'opponent' || s.step !== 0) return;
    later(() => {
      const mv = puzzle.moves[0];
      setS({ fen: applyUci(puzzle.fen, mv), step: 1, lastMove: mv, status: 'play', failed: false });
    }, 600);
  }, [puzzle, s.status, s.step]);

  const onMove = (uci: string) => {
    if (s.status !== 'play') return;
    const expected = puzzle.moves[s.step];
    const after = applyUci(s.fen, uci);
    const isLast = s.step === puzzle.moves.length - 1;
    // Any checkmate is accepted, even if it differs from the stored solution.
    const mates = new Chess(after).isCheckmate();
    if (uci === expected || mates) {
      setHint(0);
      if (isLast || mates) {
        playMoveSound('success');
        setS({ fen: after, step: puzzle.moves.length, lastMove: uci, status: 'done', failed: s.failed });
        if (!s.failed) report('solved');
        return;
      }
      const reply = puzzle.moves[s.step + 1];
      setS({ fen: after, step: s.step + 1, lastMove: uci, status: 'opponent', failed: s.failed });
      later(() => setS((cur) => ({ ...cur, fen: applyUci(after, reply), step: cur.step + 1, lastMove: reply, status: 'play' })), 450);
      return;
    }
    playMoveSound('fail');
    report('failed');
    setS({ ...s, fen: after, lastMove: uci, status: 'wrong', failed: true });
    if (allowRetry) later(() => setS((cur) => ({ ...cur, fen: s.fen, lastMove: s.lastMove, status: 'play' })), 700);
  };

  const showSolution = () => {
    report('failed');
    let fen = s.fen;
    let delay = 0;
    for (let i = s.step; i < puzzle.moves.length; i++) {
      const mv = puzzle.moves[i];
      fen = applyUci(fen, mv);
      const f = fen;
      delay += 650;
      later(() => setS((cur) => ({ ...cur, fen: f, lastMove: mv, step: i + 1, status: i + 1 === puzzle.moves.length ? 'done' : 'opponent', failed: true })), delay);
    }
  };

  const expected = puzzle.moves[s.step];
  const highlights = useMemo(() => (hint >= 1 && expected && s.status === 'play' ? { [expected.slice(0, 2)]: 'sq-hint' } : undefined), [hint, expected, s.status]);
  const shapes = useMemo(() => (hint >= 2 && expected && s.status === 'play' ? [arrow(expected, 'blue')] : []), [hint, expected, s.status]);

  const message =
    s.status === 'done'
      ? s.failed
        ? { cls: 'info', text: 'Puzzle complete.' }
        : { cls: 'ok', text: 'Solved!' }
      : s.status === 'wrong'
        ? { cls: 'bad', text: allowRetry ? 'Not the move. Try again.' : 'Wrong move.' }
        : s.status === 'opponent' && s.step === 0
          ? { cls: 'info', text: 'Watch the opponent’s move…' }
          : { cls: 'info', text: `Your move: find the best move for ${solverColor}.` };

  return (
    <div className="board-layout">
      <Board fen={s.fen} orientation={solverColor} movable={s.status === 'play' ? solverColor : undefined} onMove={onMove} lastMove={s.lastMove} highlights={highlights} shapes={shapes} />
      {showControls && (
        <div className="side-col">
          {sidebar}
          <div className={`feedback ${message.cls}`}>{message.text}</div>
          <div className="btn-row">
            {s.status !== 'done' ? (
              <>
                <button className="btn" onClick={() => setHint((h) => Math.min(2, h + 1))} disabled={s.status !== 'play'}>
                  {hint === 0 ? 'Hint' : 'Show move'}
                </button>
                <button className="btn" onClick={showSolution}>Solution</button>
              </>
            ) : (
              onNext && <button className="btn primary" onClick={onNext}>Next puzzle →</button>
            )}
          </div>
          {s.status === 'done' && (
            <div className="muted small">
              Puzzle {puzzle.id} · rated {puzzle.rating}
              <div style={{ marginTop: 4 }}>{puzzle.themes.map((t) => THEME_NAMES[t] ?? t).join(', ')}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
