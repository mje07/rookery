import type { ReactNode } from 'react';
import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, Repeat2 } from 'lucide-react';

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="btn-row">{actions}</div>}
    </header>
  );
}

export function PlayerStrip({
  name,
  color,
  meta,
  avatar,
  right,
}: {
  name: ReactNode;
  color: 'white' | 'black';
  meta?: ReactNode;
  avatar?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="player-strip">
      <div className="player">
        <span className={`avatar ${avatar ? '' : color}`}>{avatar ?? (color === 'white' ? '♔' : '♚')}</span>
        <div style={{ minWidth: 0 }}>
          <div className="player-name">{name}</div>
          {meta && <div className="player-meta">{meta}</div>}
        </div>
      </div>
      {right}
    </div>
  );
}

/** ⏮ ◀ ▶ ⏭ + flip, as one compact control bar. Extra buttons can be appended. */
export function NavBar({
  onFirst,
  onPrev,
  onNext,
  onLast,
  onFlip,
  children,
}: {
  onFirst: () => void;
  onPrev: () => void;
  onNext: () => void;
  onLast: () => void;
  onFlip?: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="ctrl-bar">
      <button className="icon-btn" onClick={onFirst} title="Start (Home)" aria-label="Start"><ChevronFirst size={19} /></button>
      <button className="icon-btn" onClick={onPrev} title="Previous (←)" aria-label="Previous"><ChevronLeft size={19} /></button>
      <button className="icon-btn" onClick={onNext} title="Next (→)" aria-label="Next"><ChevronRight size={19} /></button>
      <button className="icon-btn" onClick={onLast} title="End (End)" aria-label="End"><ChevronLast size={19} /></button>
      {onFlip && (
        <>
          <span className="ctrl-sep" />
          <button className="icon-btn" onClick={onFlip} title="Flip board" aria-label="Flip board"><Repeat2 size={18} /></button>
        </>
      )}
      {children && <span className="ctrl-sep" />}
      {children}
    </div>
  );
}
