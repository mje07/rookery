import type { AnalysisResult, AnalyzeOptions, PvLine } from './types';
import { parseBestMove, parseInfo } from './uci';

export type EngineFlavor = 'fast' | 'strong';

export interface EngineInfo {
  flavor: EngineFlavor;
  threads: number;
  hashMb: number;
  /** Multi-threaded build in use (page is cross-origin isolated). */
  multiThreaded: boolean;
  file: string;
}

let flavor: EngineFlavor = 'fast';

/** Which network to use: "fast" (lite NNUE, ~1.7 MB) or "strong" (full NNUE, ~94 MB, cached by the browser). */
export function setEngineFlavor(f: EngineFlavor) {
  if (f === flavor) return;
  flavor = f;
  // Restart engines so the next job loads the new build.
  shared?.terminate();
  bot?.terminate();
}

function pickBuild(): { file: string; multiThreaded: boolean } {
  const isolated = typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated && typeof SharedArrayBuffer !== 'undefined';
  const base = flavor === 'strong' ? 'stockfish-19' : 'stockfish-19-lite';
  return { file: isolated ? `${base}.js` : `${base}-single.js`, multiThreaded: isolated };
}

interface Job {
  fen: string;
  opts: AnalyzeOptions;
  resolve: (r: AnalysisResult) => void;
  reject: (e: unknown) => void;
}

/** Internal signal delivered to all listeners when the worker is restarted. */
const RESTART = '__engine_restart__';

const EMPTY = (fen: string): AnalysisResult => ({ fen, depth: 0, bestMove: null, lines: [] });

/**
 * One Stockfish worker shared by a feature. Jobs run strictly one at a time; aborting a job
 * sends `stop` and the result (whatever depth was reached) still resolves. A watchdog restarts the
 * worker if a bounded search never reports `bestmove` (e.g. the WASM worker crashed).
 */
export class EngineService {
  private worker: Worker | null = null;
  private ready: Promise<void> | null = null;
  private queue: Job[] = [];
  private running: Job | null = null;
  private lines = new Map<number, PvLine>();
  private listeners: ((line: string) => void)[] = [];
  private currentOptions: Record<string, string> = {};
  private info: EngineInfo | null = null;
  private readonly role: 'analysis' | 'bot';

  constructor(role: 'analysis' | 'bot' = 'analysis') {
    this.role = role;
  }

  /** Details of the running build (after the first job has booted it). */
  getInfo(): EngineInfo | null {
    return this.info;
  }

  private boot(): Promise<void> {
    if (this.ready) return this.ready;
    const build = pickBuild();
    this.worker = new Worker(`${import.meta.env.BASE_URL}engine/${build.file}`);
    this.worker.onmessage = (ev: MessageEvent) => {
      const text = typeof ev.data === 'string' ? ev.data : String(ev.data);
      for (const line of text.split('\n')) for (const l of [...this.listeners]) l(line.trim());
    };
    this.worker.onerror = (e) => {
      console.error('Stockfish worker error', e.message);
      this.restart();
    };
    const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 2 : 2;
    // Bots get one thread (they're throttled anyway); analysis gets all but one core, capped for memory.
    const threads = build.multiThreaded && this.role === 'analysis' ? Math.max(1, Math.min(cores - 1, 8)) : 1;
    const hashMb = this.role === 'analysis' ? (flavor === 'strong' ? 128 : 64) : 16;
    this.info = { flavor, threads, hashMb, multiThreaded: build.multiThreaded, file: build.file };
    this.ready = this.waitFor('uciok', 'uci')
      .then(() => {
        this.setOption('Threads', String(threads));
        this.setOption('Hash', String(hashMb));
        return this.waitFor('readyok', 'isready');
      })
      .then(() => undefined);
    return this.ready;
  }

  private send(cmd: string) {
    this.worker?.postMessage(cmd);
  }

  private waitFor(token: string, cmd?: string): Promise<string> {
    return new Promise((resolve) => {
      const l = (line: string) => {
        if (line.startsWith(token) || line === RESTART) {
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
        resolve(EMPTY(fen));
        return;
      }
      this.queue.push({ fen, opts, resolve, reject });
      void this.pump();
    });
  }

  /** Drop all queued jobs and stop the running one. */
  cancelAll() {
    for (const j of this.queue) j.resolve(EMPTY(j.fen));
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
      if (!this.worker) throw new Error('Stockfish failed to start');
      await this.run(job);
    } catch (e) {
      job.reject(e);
    } finally {
      this.running = null;
      void this.pump();
    }
  }

  /** Kill the worker; the next job boots a fresh one. Pending listeners are dropped. */
  private restart() {
    this.worker?.terminate();
    this.worker = null;
    this.ready = null;
    this.currentOptions = {};
    const pending = this.listeners;
    this.listeners = [];
    // Release every waiter: in-flight searches resolve with what they have, boot waits give up.
    for (const l of pending) l(RESTART);
  }

  private async run(job: Job) {
    const { fen, opts } = job;
    // Cancelled while queued (e.g. the user moved on): don't start a search nobody is waiting for.
    if (opts.signal?.aborted) {
      job.resolve(EMPTY(fen));
      return;
    }
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
    let nps = 0;
    let nodes = 0;
    const result = (): AnalysisResult => {
      const lines = [...this.lines.values()].sort((a, b) => a.multipv - b.multipv).slice(0, multiPV);
      return { fen, depth: lines[0]?.depth ?? 0, bestMove: lines[0]?.pv[0] ?? null, lines, nps, nodes };
    };

    const done = new Promise<AnalysisResult>((resolve) => {
      const l = (line: string) => {
        if (line.startsWith('info ')) {
          const m = / nps (\d+)/.exec(line);
          if (m) nps = Number(m[1]);
          const n = / nodes (\d+)/.exec(line);
          if (n) nodes = Number(n[1]);
        }
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
        const bm = line === RESTART ? null : parseBestMove(line);
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
    const infinite = !opts.depth && !opts.movetime && !opts.nodes;
    if (infinite) parts.push('infinite');
    if (opts.searchMoves?.length) parts.push('searchmoves', ...opts.searchMoves);
    const onAbort = () => this.send('stop');
    opts.signal?.addEventListener('abort', onAbort, { once: true });
    // Aborted during option setup (before the listener existed): stop as soon as the search starts.
    const abortedEarly = !!opts.signal?.aborted;

    // Watchdog for bounded searches: generous, since deep/strong searches on slow machines can take a while.
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    if (!infinite) {
      const limit = (opts.movetime ?? 0) + (opts.depth && opts.depth > 20 ? 120_000 : 45_000);
      watchdog = setTimeout(() => {
        console.warn('Stockfish did not answer in time; restarting the engine');
        this.restart();
      }, limit);
    }
    this.send(parts.join(' '));
    if (abortedEarly) this.send('stop');
    const r = await done;
    clearTimeout(watchdog);
    opts.signal?.removeEventListener('abort', onAbort);
    job.resolve(r);
  }

  terminate() {
    this.cancelAll();
    this.restart();
  }
}

let shared: EngineService | null = null;
/** Engine used for analysis (review, analysis board, lesson checks). */
export function analysisEngine(): EngineService {
  return (shared ??= new EngineService('analysis'));
}

let bot: EngineService | null = null;
/** Separate engine for the play-vs-bot opponent so analysis never blocks it. */
export function botEngine(): EngineService {
  return (bot ??= new EngineService('bot'));
}
