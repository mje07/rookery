import Dexie, { type EntityTable } from 'dexie';
import type { MoveTree } from '../chess/tree';
import type { ReviewData } from '../features/review/types';

export interface GameRecord {
  id?: number;
  pgn: string;
  white: string;
  black: string;
  result: string;
  date: string;
  source: 'import' | 'bot';
  addedAt: number;
  /** Bot games: which bot, and which side the user played. */
  botId?: string;
  userColor?: 'white' | 'black';
  /** Set once the review's mistakes have been added to the mistake trainer. */
  mistakesBanked?: boolean;
}

export interface ReviewRecord {
  gameId: number;
  depth: number;
  createdAt: number;
  data: ReviewData;
}

export interface PuzzleAttempt {
  id?: number;
  puzzleId: string;
  mode: string;
  solved: boolean;
  rating: number;
  userRatingAfter: number;
  at: number;
  themes?: string[];
}

export interface LessonProgress {
  lessonId: string;
  completedSteps: number;
  completed: boolean;
  updatedAt: number;
}

export interface Repertoire {
  id?: number;
  name: string;
  color: 'white' | 'black';
  tree: MoveTree;
  createdAt: number;
}

/** A spaced-repetition card: "in this position (from repertoire), play this move". */
export interface RepCard {
  id?: number;
  repertoireId: number;
  /** FEN with move counters stripped, so transpositions share a card. */
  key: string;
  fen: string;
  uci: string;
  san: string;
  /** Opponent's move that led to this position (for highlighting). */
  lastUci?: string;
  ease: number;
  interval: number; // days
  reps: number;
  due: number; // epoch ms
  lapses: number;
}

/** A position the user got wrong (in their own game, or a failed puzzle), scheduled for re-solving. */
export interface MistakeCard {
  id?: number;
  source: 'game' | 'puzzle';
  /** Dedup key: "game:<gameId>:<ply>" or "puzzle:<puzzleId>". */
  key: string;
  /** Game cards: the position and the best move; any move the engine rates as close is accepted. */
  fen?: string;
  bestUci?: string;
  bestSan?: string;
  playedSan?: string;
  lastUci?: string;
  classification?: string;
  explanation?: string;
  /** Mover's win% before the move (to judge alternatives). */
  winBefore?: number;
  gameId?: number;
  /** Puzzle cards: the full puzzle, replayed from the start. */
  puzzle?: { id: string; fen: string; moves: string[]; rating: number; themes: string[] };
  ease: number;
  interval: number;
  reps: number;
  due: number;
  lapses: number;
  createdAt: number;
}

/** One row per calendar day of training. */
export interface DailyLog {
  date: string; // YYYY-MM-DD (local)
  done: Record<string, boolean>;
  minutes?: number;
}

export interface Setting {
  key: string;
  value: unknown;
}

class RookeryDB extends Dexie {
  games!: EntityTable<GameRecord, 'id'>;
  reviews!: EntityTable<ReviewRecord, 'gameId'>;
  puzzleAttempts!: EntityTable<PuzzleAttempt, 'id'>;
  lessonProgress!: EntityTable<LessonProgress, 'lessonId'>;
  repertoires!: EntityTable<Repertoire, 'id'>;
  repCards!: EntityTable<RepCard, 'id'>;
  mistakes!: EntityTable<MistakeCard, 'id'>;
  dailyLog!: EntityTable<DailyLog, 'date'>;
  settings!: EntityTable<Setting, 'key'>;

  constructor() {
    super('rookery');
    this.version(1).stores({
      games: '++id, addedAt, source',
      reviews: 'gameId',
      puzzleAttempts: '++id, puzzleId, mode, at',
      lessonProgress: 'lessonId',
      repertoires: '++id, name',
      repCards: '++id, repertoireId, due, [repertoireId+key+uci]',
      settings: 'key',
    });
    this.version(2).stores({
      mistakes: '++id, &key, due, source',
      dailyLog: 'date',
    });
  }
}

export const db = new RookeryDB();

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const s = await db.settings.get(key);
  return (s?.value as T) ?? fallback;
}

export async function setSetting(key: string, value: unknown) {
  await db.settings.put({ key, value });
}

/** Local calendar date as YYYY-MM-DD. */
export function today(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
