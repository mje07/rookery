import { useEffect, useState } from 'react';
import { Chess } from 'chess.js';
import { analysisEngine } from '../engine/EngineService';
import type { AnalysisResult } from '../engine/types';

/** Continuously analyse `fen` while enabled; restarts on position change. */
export function useLiveEngine(fen: string, enabled: boolean, multiPV = 3, maxDepth = 30) {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  useEffect(() => {
    setResult(null);
    if (!enabled) return;
    if (new Chess(fen).isGameOver()) return;
    const ctrl = new AbortController();
    const engine = analysisEngine();
    // Throttle UI updates to ~8/s.
    let last = 0;
    void engine
      .analyze(fen, {
        depth: maxDepth,
        multiPV,
        signal: ctrl.signal,
        onUpdate: (r) => {
          const now = performance.now();
          if (now - last > 120 && !ctrl.signal.aborted) {
            last = now;
            setResult(r);
          }
        },
      })
      .then((r) => {
        if (!ctrl.signal.aborted) setResult(r);
      });
    return () => ctrl.abort();
  }, [fen, enabled, multiPV, maxDepth]);
  return result;
}
