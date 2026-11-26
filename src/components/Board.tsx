import { createElement, useEffect, useRef, useState } from 'react';
import { Chessground } from '@lichess-org/chessground';
import type { Api } from '@lichess-org/chessground/api';
import type { DrawShape } from '@lichess-org/chessground/draw';
import type { Key } from '@lichess-org/chessground/types';
import '@lichess-org/chessground/assets/chessground.base.css';
import '@lichess-org/chessground/assets/chessground.cburnett.css';
import { Chess } from 'chess.js';
import { isPromotion, legalDests, turnColor } from '../chess/tree';
import { playMoveSound } from '../lib/sound';

export type Color = 'white' | 'black';

export interface BoardProps {
  fen: string;
  orientation?: Color;
  /** Which side(s) the user may move. Omit for a view-only board. */
  movable?: Color | 'both';
  /** Called with a UCI move after the user plays a legal move. */
  onMove?: (uci: string) => void;
  lastMove?: string; // UCI
  shapes?: DrawShape[];
  /** CSS classes per square, e.g. { e4: 'sq-hint' }. */
  highlights?: Record<string, string>;
  /** SVG badge drawn on a square (chessground customSvg space: square = 100×100, origin top-left). */
  badge?: { square: string; svg: string };
  sound?: boolean;
}

const PROMO_PIECES = ['q', 'n', 'r', 'b'] as const;
const PIECE_NAME = { q: 'queen', n: 'knight', r: 'rook', b: 'bishop' } as const;

export function Board({
  fen,
  orientation = 'white',
  movable,
  onMove,
  lastMove,
  shapes = [],
  highlights,
  badge,
  sound = true,
}: BoardProps) {
  const el = useRef<HTMLDivElement>(null);
  const api = useRef<Api | null>(null);
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;
  const fenRef = useRef(fen);
  fenRef.current = fen;
  const [promo, setPromo] = useState<{ from: string; to: string } | null>(null);
  const prevFen = useRef(fen);

  useEffect(() => {
    if (!el.current) return;
    api.current = Chessground(el.current, {
      animation: { enabled: true, duration: 180 },
      // Rank numbers are drawn on the left edge; chessground needs to know so it tags their square colours correctly.
      ranksPosition: 'left',
      highlight: { lastMove: true, check: true },
      movable: {
        free: false,
        showDests: true,
        events: {
          after: (orig, dest) => {
            const f = fenRef.current;
            if (isPromotion(f, orig, dest)) {
              setPromo({ from: orig, to: dest });
              return;
            }
            onMoveRef.current?.(orig + dest);
          },
        },
      },
      draggable: { showGhost: true },
      premovable: { enabled: false },
    });
    return () => api.current?.destroy();
  }, []);

  useEffect(() => {
    const chess = new Chess(fen);
    const color = turnColor(fen);
    const canMove = movable === 'both' || movable === color;
    api.current?.set({
      fen,
      orientation,
      turnColor: color,
      check: chess.inCheck() ? color : false,
      lastMove: lastMove ? ([lastMove.slice(0, 2), lastMove.slice(2, 4)] as Key[]) : undefined,
      movable: {
        color: canMove ? color : undefined,
        dests: canMove ? (legalDests(fen) as Map<Key, Key[]>) : new Map(),
      },
      highlight: { custom: new Map(Object.entries(highlights ?? {}) as [Key, string][]) },
    });
    if (sound && prevFen.current !== fen && lastMove) {
      const before = prevFen.current;
      try {
        const c = new Chess(before);
        const m = c.move({ from: lastMove.slice(0, 2), to: lastMove.slice(2, 4), promotion: lastMove[4] });
        playMoveSound(m.captured ? 'capture' : c.inCheck() ? 'check' : 'move');
      } catch {
        // position jumped (navigation); no sound
      }
    }
    prevFen.current = fen;
  }, [fen, orientation, movable, lastMove, highlights, sound]);

  useEffect(() => {
    const all: DrawShape[] = [...shapes];
    if (badge) all.push({ orig: badge.square as Key, customSvg: { html: badge.svg } });
    api.current?.setAutoShapes(all);
  }, [shapes, badge]);

  const choose = (p: (typeof PROMO_PIECES)[number] | null) => {
    const pr = promo;
    setPromo(null);
    if (!pr || !p) {
      api.current?.set({ fen: fenRef.current }); // undo the visual move
      return;
    }
    onMoveRef.current?.(pr.from + pr.to + p);
  };

  const promoColor = turnColor(fen);
  return (
    <div className="board-wrap">
      <div ref={el} className="cg-host" />
      {promo && (
        <div className="promo-overlay" onClick={() => choose(null)}>
          <div className="promo-box" onClick={(e) => e.stopPropagation()}>
            {PROMO_PIECES.map((p) => (
              <button key={p} className="promo-btn" onClick={() => choose(p)} aria-label={PIECE_NAME[p]}>
                <div className="cg-wrap promo-piece">
                  {createElement('piece', { className: `${PIECE_NAME[p]} ${promoColor}` })}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Arrow helper: UCI move -> chessground shape. */
export function arrow(uci: string, brush = 'green', lineWidth?: number): DrawShape {
  return {
    orig: uci.slice(0, 2) as Key,
    dest: uci.slice(2, 4) as Key,
    brush,
    modifiers: lineWidth ? { lineWidth } : undefined,
  };
}
