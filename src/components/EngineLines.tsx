import type { AnalysisResult } from '../engine/types';
import { formatScore } from '../chess/evalMath';
import { moveNumberLabel, uciLineToSan } from '../chess/tree';

interface Props {
  fen: string;
  result: AnalysisResult | null;
  /** Play the first n moves of a line (n = index+1). */
  onPlayLine?: (uci: string[]) => void;
}

export function EngineLines({ fen, result, onPlayLine }: Props) {
  if (!result || !result.lines.length) return <div className="engine-lines muted small">Thinking…</div>;
  return (
    <div className="engine-lines">
      <div className="muted small">Depth {result.depth}</div>
      {result.lines.map((l) => {
        const san = uciLineToSan(fen, l.pv.slice(0, 12));
        return (
          <div key={l.multipv} className="engine-line">
            <span className="score">{formatScore(l.score)}</span>
            <span className="pv">
              {moveNumberLabel(fen)}{' '}
              {san.map((s, i) => (
                <span key={i} onClick={() => onPlayLine?.(l.pv.slice(0, i + 1))}>
                  {s}{' '}
                </span>
              ))}
            </span>
          </div>
        );
      })}
    </div>
  );
}
