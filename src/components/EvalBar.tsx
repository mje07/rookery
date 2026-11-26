import type { Score } from '../engine/types';
import { formatScore, winPct } from '../chess/evalMath';

export function EvalBar({ score, orientation = 'white' }: { score?: Score; orientation?: 'white' | 'black' }) {
  const white = score ? winPct(score) : 50;
  const whiteOnBottom = orientation === 'white';
  const label = formatScore(score);
  const whiteAhead = white >= 50;
  return (
    <div className={`eval-bar ${whiteOnBottom ? '' : 'flipped'}`} title={label}>
      <div className="eval-white" style={{ height: `${white}%` }} />
      <span className={`eval-label ${whiteAhead === whiteOnBottom ? 'bottom' : 'top'} ${whiteAhead ? 'on-white' : 'on-black'}`}>
        {label.replace('+', '')}
      </span>
    </div>
  );
}
