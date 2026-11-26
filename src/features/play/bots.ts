import { Chess } from 'chess.js';
import type { EngineService } from '../../engine/EngineService';
import { scoreToCp } from '../../chess/evalMath';

export interface Bot {
  id: string;
  name: string;
  rating: number;
  avatar: string;
  blurb: string;
  /** Search limits + UCI options for this bot. */
  depth?: number;
  movetime?: number;
  options?: Record<string, string | number | boolean>;
  /** Chance (0..1) of picking a non-best line among the top `multiPV`. */
  randomness?: number;
  multiPV?: number;
  /** Max centipawn loss a random pick may have vs the best line. */
  maxLoss?: number;
}

export const BOTS: Bot[] = [
  { id: 'pip', name: 'Pip', rating: 250, avatar: '🐣', blurb: 'Just learned how the pieces move. Leaves things hanging.', depth: 1, multiPV: 8, randomness: 0.7, maxLoss: 900, options: { 'Skill Level': 0 } },
  { id: 'bramble', name: 'Bramble', rating: 400, avatar: '🐭', blurb: 'Knows the rules, still drops pieces now and then.', depth: 1, multiPV: 6, randomness: 0.55, maxLoss: 700, options: { 'Skill Level': 0 } },
  { id: 'moss', name: 'Moss', rating: 550, avatar: '🐢', blurb: 'Slow and steady, but misses simple tactics.', depth: 2, multiPV: 6, randomness: 0.45, maxLoss: 500, options: { 'Skill Level': 0 } },
  { id: 'fern', name: 'Fern', rating: 700, avatar: '🦎', blurb: 'Develops sensibly but misses forks and pins.', depth: 3, multiPV: 5, randomness: 0.37, maxLoss: 400, options: { 'Skill Level': 1 } },
  { id: 'juniper', name: 'Juniper', rating: 850, avatar: '🦊', blurb: 'Likes to attack, sometimes too early.', depth: 4, multiPV: 5, randomness: 0.3, maxLoss: 300, options: { 'Skill Level': 2 } },
  { id: 'cobalt', name: 'Cobalt', rating: 1000, avatar: '🐺', blurb: 'Steady. Spots most one-move tactics against it.', depth: 5, multiPV: 4, randomness: 0.24, maxLoss: 240, options: { 'Skill Level': 3 } },
  { id: 'otto', name: 'Otto', rating: 1150, avatar: '🦉', blurb: 'Solid club player. Punishes loose pieces.', depth: 6, multiPV: 4, randomness: 0.18, maxLoss: 180, options: { 'Skill Level': 5 } },
  { id: 'sable', name: 'Sable', rating: 1350, avatar: '🦡', blurb: 'Patient club player. Converts small advantages.', movetime: 350, options: { UCI_LimitStrength: true, UCI_Elo: 1350 } },
  { id: 'wren', name: 'Wren', rating: 1450, avatar: '🐦', blurb: 'Plays principled openings and clean endgames.', movetime: 400, options: { UCI_LimitStrength: true, UCI_Elo: 1450 } },
  { id: 'ember', name: 'Ember', rating: 1600, avatar: '🐆', blurb: 'Sharp and tactical. Punishes loose kings.', movetime: 500, options: { UCI_LimitStrength: true, UCI_Elo: 1600 } },
  { id: 'basil', name: 'Basil', rating: 1800, avatar: '🐻', blurb: 'Tournament regular. Grinds small edges.', movetime: 600, options: { UCI_LimitStrength: true, UCI_Elo: 1800 } },
  { id: 'onyx', name: 'Onyx', rating: 2000, avatar: '🦅', blurb: 'Candidate master strength. Clean technique.', movetime: 700, options: { UCI_LimitStrength: true, UCI_Elo: 2000 } },
  { id: 'quill', name: 'Quill', rating: 2200, avatar: '🦔', blurb: 'Expert-level calculation. Rarely blunders.', movetime: 800, options: { UCI_LimitStrength: true, UCI_Elo: 2200 } },
  { id: 'vesper', name: 'Vesper', rating: 2650, avatar: '🦇', blurb: 'Grandmaster strength.', movetime: 1000, options: { UCI_LimitStrength: true, UCI_Elo: 2650 } },
  { id: 'apex', name: 'Apex', rating: 3200, avatar: '🤖', blurb: 'The engine at full strength. Good luck.', movetime: 1500 },
];

/** Ask the engine for the bot's move in `fen` (UCI). */
export async function botMove(engine: EngineService, bot: Bot, fen: string, signal?: AbortSignal): Promise<string | null> {
  const chess = new Chess(fen);
  const legal = chess.moves({ verbose: true });
  if (!legal.length) return null;
  const r = await engine.analyze(fen, {
    depth: bot.depth,
    movetime: bot.movetime,
    multiPV: bot.multiPV ?? 1,
    options: bot.options,
    signal,
  });
  if (signal?.aborted) return null;
  const best = r.bestMove ?? legal[0].from + legal[0].to;
  if (!bot.randomness || r.lines.length < 2 || Math.random() >= bot.randomness) return best;
  // Pick a plausible inferior line within the bot's loss budget.
  const side = fen.split(' ')[1] === 'b' ? -1 : 1;
  const bestCp = side * scoreToCp(r.lines[0].score);
  const pool = r.lines.slice(1).filter((l) => bestCp - side * scoreToCp(l.score) <= (bot.maxLoss ?? 200));
  if (!pool.length) return best;
  return pool[Math.floor(Math.random() * pool.length)].pv[0];
}

export interface TimeControl {
  id: string;
  label: string;
  base: number; // seconds; 0 = untimed
  inc: number;
}

export const TIME_CONTROLS: TimeControl[] = [
  { id: 'none', label: 'No clock', base: 0, inc: 0 },
  { id: '3+2', label: '3 | 2', base: 180, inc: 2 },
  { id: '5+3', label: '5 | 3', base: 300, inc: 3 },
  { id: '10+0', label: '10 min', base: 600, inc: 0 },
  { id: '15+10', label: '15 | 10', base: 900, inc: 10 },
  { id: '30+0', label: '30 min', base: 1800, inc: 0 },
];
