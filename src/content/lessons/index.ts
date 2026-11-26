import type { Lesson } from '../../features/lessons/types';
import { basics } from './basics';
import { tactics } from './tactics';
import { checkmates } from './checkmates';
import { endgames } from './endgames';
import { openingsAndStrategy } from './openingsStrategy';

export const LESSONS: Lesson[] = [...basics, ...tactics, ...checkmates, ...endgames, ...openingsAndStrategy];

export const CATEGORIES = [...new Set(LESSONS.map((l) => l.category))];

export function lessonById(id: string): Lesson | undefined {
  return LESSONS.find((l) => l.id === id);
}
