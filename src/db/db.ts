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
