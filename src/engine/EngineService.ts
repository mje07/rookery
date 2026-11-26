import type { AnalysisResult, AnalyzeOptions, PvLine } from './types';
import { parseBestMove, parseInfo } from './uci';

const ENGINE_URL = `${import.meta.env.BASE_URL}engine/stockfish-19-lite-single.js`;

interface Job {
  fen: string;
  opts: AnalyzeOptions;
  resolve: (r: AnalysisResult) => void;
  reject: (e: unknown) => void;
}

/**
 * One Stockfish worker shared by a feature. Jobs run strictly one at a time; aborting a job
 * sends `stop` and the result (whatever depth was reached) still resolves.
 */
export class EngineService {
  private worker: Worker | null = null;
  private ready: Promise<void> | null = null;
  private queue: Job[] = [];
  private running: Job | null = null;
  private lines = new Map<number, PvLine>();
  private listeners: ((line: string) => void)[] = [];
  private currentOptions: Record<string, string> = {};

  private boot(): Promise<void> {
    if (this.ready) return this.ready;
    this.worker = new Worker(ENGINE_URL);
    this.worker.onmessage = (ev: MessageEvent) => {
      const text = typeof ev.data === 'string' ? ev.data : String(ev.data);
      for (const line of text.split('\n')) for (const l of [...this.listeners]) l(line.trim());
    };
    this.ready = this.waitFor('uciok', 'uci')
      .then(() => this.waitFor('readyok', 'isready'))
      .then(() => undefined);
    return this.ready;
  }

  private send(cmd: string) {
    this.worker!.postMessage(cmd);
  }

  private waitFor(token: string, cmd?: string): Promise<string> {
    return new Promise((resolve) => {
      const l = (line: string) => {
        if (line.startsWith(token)) {
          this.listeners = this.listeners.filter((x) => x !== l);
          resolve(line);
        }
      };
      this.listeners.push(l);
      if (cmd) this.send(cmd);
    });
  }

  analyze(fen: string, opts: AnalyzeOptions = {}): Promise<AnalysisResult> {
    return new Promise((resolve, reject) => {
      if (opts.signal?.aborted) {
        resolve({ fen, depth: 0, bestMove: null, lines: [] });
        return;
      }
      this.queue.push({ fen, opts, resolve, reject });
      void this.pump();
    });
  }

  /** Drop all queued jobs and stop the running one. */
  cancelAll() {
    for (const j of this.queue) j.resolve({ fen: j.fen, depth: 0, bestMove: null, lines: [] });
    this.queue = [];
    if (this.running) this.send('stop');
  }

  /** Clear hash tables between unrelated games. */
  async newGame() {
    await this.boot();
    this.send('ucinewgame');
    await this.waitFor('readyok', 'isready');
  }

  private setOption(name: string, value: string) {
    if (this.currentOptions[name] === value) return;
    this.currentOptions[name] = value;
    this.send(`setoption name ${name} value ${value}`);
  }

  private async pump() {
    if (this.running) return;
    const job = this.queue.shift();
    if (!job) return;
    this.running = job;
    try {
      await this.boot();
      await this.run(job);
    } catch (e) {
      job.reject(e);
    } finally {
      this.running = null;
      void this.pump();
    }
  }

  private async run(job: Job) {
    const { fen, opts } = job;
    const multiPV = opts.multiPV ?? 1;
    // Defaults first, then per-job overrides (strength limits are only for play mode).
    const wanted: Record<string, string> = {
      MultiPV: String(multiPV),
      UCI_LimitStrength: 'false',
      'Skill Level': '20',
    };
    for (const [k, v] of Object.entries(opts.options ?? {})) wanted[k] = String(v);
    for (const [k, v] of Object.entries(wanted)) this.setOption(k, v);
    this.send('isready');
    await this.waitFor('readyok');

    this.lines.clear();
    const result = (): AnalysisResult => {
      const lines = [...this.lines.values()].sort((a, b) => a.multipv - b.multipv).slice(0, multiPV);
      return { fen, depth: lines[0]?.depth ?? 0, bestMove: lines[0]?.pv[0] ?? null, lines };
    };

    const done = new Promise<AnalysisResult>((resolve) => {
      const l = (line: string) => {
        const info = parseInfo(line, fen);
        if (info) {
          // A new depth for pv 1 invalidates shallower lines of other ranks.
          if (info.multipv === 1) {
            for (const [k, v] of this.lines) if (v.depth < info.depth - 1) this.lines.delete(k);
          }
          this.lines.set(info.multipv, info);
          opts.onUpdate?.(result());
          return;
        }
        const bm = parseBestMove(line);
        if (bm !== undefined) {
          this.listeners = this.listeners.filter((x) => x !== l);
          const r = result();
          resolve({ ...r, bestMove: bm ?? r.bestMove });
        }
      };
      this.listeners.push(l);
    });

    this.send(`position fen ${fen}`);
    const parts = ['go'];
    if (opts.depth) parts.push('depth', String(opts.depth));
    if (opts.movetime) parts.push('movetime', String(opts.movetime));
    if (opts.nodes) parts.push('nodes', String(opts.nodes));
    if (!opts.depth && !opts.movetime && !opts.nodes) parts.push('infinite');
    if (opts.searchMoves?.length) parts.push('searchmoves', ...opts.searchMoves);
    const onAbort = () => this.send('stop');
    opts.signal?.addEventListener('abort', onAbort, { once: true });
    this.send(parts.join(' '));
    const r = await done;
    opts.signal?.removeEventListener('abort', onAbort);
    job.resolve(r);
  }

  terminate() {
    this.cancelAll();
    this.worker?.terminate();
    this.worker = null;
    this.ready = null;
    this.currentOptions = {};
  }
}

let shared: EngineService | null = null;
/** Engine used for analysis (review, analysis board, lesson checks). */
export function analysisEngine(): EngineService {
  return (shared ??= new EngineService());
}

let bot: EngineService | null = null;
/** Separate engine for the play-vs-bot opponent so analysis never blocks it. */
export function botEngine(): EngineService {
  return (bot ??= new EngineService());
}
