// Node-hosted Stockfish (same WASM build as the app) implementing ReviewEngine, for integration tests.
import { createRequire } from 'node:module';
import type { AnalysisResult, AnalyzeOptions, PvLine } from '../src/engine/types';
import { parseBestMove, parseInfo } from '../src/engine/uci';
import type { ReviewEngine } from '../src/features/review/analyzeGame';

const require = createRequire(import.meta.url);

export function createNodeEngine(): ReviewEngine & { quit(): void } {
  const init = require('stockfish') as (flavor: string, cb: (line: string) => void) => { processCommand(c: string): void; terminate(): void };
  let listener: (line: string) => void = () => {};
  const engine = init('lite-single', (line) => listener(line));
  const waitFor = (token: string, ...cmds: string[]) =>
    new Promise<void>((res) => {
      listener = (l) => {
        if (l.startsWith(token)) res();
      };
      for (const c of cmds) engine.processCommand(c);
    });
  let ready: Promise<void> | null = null;
  const boot = () => (ready ??= waitFor('uciok', 'uci').then(() => waitFor('readyok', 'isready')));
  let multi = -1;
  let chain: Promise<unknown> = Promise.resolve();
  const analyze = (fen: string, opts: AnalyzeOptions): Promise<AnalysisResult> => {
    const job = chain.then(async () => {
      await boot();
      const mpv = opts.multiPV ?? 1;
      if (mpv !== multi) {
        multi = mpv;
        await waitFor('readyok', `setoption name MultiPV value ${mpv}`, 'isready');
      }
      const lines = new Map<number, PvLine>();
      return new Promise<AnalysisResult>((res) => {
        listener = (l) => {
          const info = parseInfo(l, fen);
          if (info) return void lines.set(info.multipv, info);
          const bm = parseBestMove(l);
          if (bm !== undefined) {
            const ls = [...lines.values()].sort((a, b) => a.multipv - b.multipv).slice(0, mpv);
            res({ fen, depth: ls[0]?.depth ?? 0, bestMove: bm ?? ls[0]?.pv[0] ?? null, lines: ls });
          }
        };
        engine.processCommand(`position fen ${fen}`);
        engine.processCommand(opts.nodes ? `go nodes ${opts.nodes}` : `go depth ${opts.depth ?? 10}`);
      });
    });
    chain = job.catch(() => {});
    return job;
  };
  return {
    analyze,
    newGame: async () => {
      await boot();
      await waitFor('readyok', 'ucinewgame', 'isready');
    },
    quit: () => engine.terminate(),
  };
}
