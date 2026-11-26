import type { Lesson } from '../../features/lessons/types';
import { basics } from './basics';
import { tactics } from './tactics';
import { checkmates } from './checkmates';
import { endgames } from './endgames';
import { openingsAndStrategy } from './openingsStrategy';
import { fundamentals } from './fundamentals';

const [blunderCheck, removingDefender, mateInTwo, tradingAhead] = fundamentals;
const insertAfter = (list: Lesson[], afterId: string, lesson: Lesson) => {
  const i = list.findIndex((l) => l.id === afterId);
  return [...list.slice(0, i + 1), lesson, ...list.slice(i + 1)];
};

export const LESSONS: Lesson[] = [
  ...basics,
  blunderCheck,
  ...insertAfter(tactics, 'discovered', removingDefender),
  ...insertAfter(checkmates, 'queen-mates', mateInTwo),
  ...endgames,
  ...openingsAndStrategy,
  tradingAhead,
];

export const CATEGORIES = [...new Set(LESSONS.map((l) => l.category))];

export function lessonById(id: string): Lesson | undefined {
  return LESSONS.find((l) => l.id === id);
}
