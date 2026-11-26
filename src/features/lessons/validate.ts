import { Chess } from 'chess.js';
import type { Lesson } from './types';

/** Static checks on lesson content: FENs parse, solutions are legal, quizzes are well-formed. Returns problems. */
export function validateLesson(lesson: Lesson): string[] {
  const errs: string[] = [];
  lesson.steps.forEach((step, i) => {
    const where = `${lesson.id} step ${i + 1}`;
    if (step.fen) {
      try {
        new Chess(step.fen);
      } catch (e) {
        errs.push(`${where}: bad FEN (${(e as Error).message})`);
        return;
      }
    }
    if (step.type === 'move') {
      const c = new Chess(step.fen);
      for (const [k, u] of step.solution.entries()) {
        try {
          c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
        } catch {
          errs.push(`${where}: illegal solution move ${k + 1} (${u})`);
          return;
        }
      }
      if (step.accept === 'mate' && !c.isCheckmate()) errs.push(`${where}: accept=mate but solution doesn't mate`);
      if (step.accept === 'engine' && step.solution.length !== 1) errs.push(`${where}: engine steps must be single-move`);
      for (const a of step.alts ?? []) {
        try {
          new Chess(step.fen).move({ from: a.slice(0, 2), to: a.slice(2, 4), promotion: a[4] });
        } catch {
          errs.push(`${where}: illegal alt ${a}`);
        }
      }
    }
    if (step.type === 'quiz' && (step.answer < 0 || step.answer >= step.options.length)) errs.push(`${where}: answer index out of range`);
    if (step.type === 'play') {
      const c = new Chess(step.fen);
      if (c.isGameOver()) errs.push(`${where}: play position is already over`);
    }
  });
  return errs;
}
