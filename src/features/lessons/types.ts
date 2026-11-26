export interface Arrow {
  from: string;
  to: string;
  color?: 'green' | 'red' | 'blue' | 'yellow';
}

interface StepBase {
  /** Short paragraphs; **bold** is supported. Paragraphs are separated by blank lines. */
  text: string;
  fen?: string;
  arrows?: Arrow[];
  /** Squares to highlight. */
  squares?: string[];
  orientation?: 'white' | 'black';
}

export interface TextStep extends StepBase {
  type: 'text';
}

/** Find the move(s). `solution` alternates: user, reply, user, ... (UCI). */
export interface MoveStep extends StepBase {
  type: 'move';
  fen: string;
  solution: string[];
  /**
   * exact: only the solution move (or `alts` at the first move).
   * mate: any checkmating move is accepted at the final move.
   * engine: (single-move steps) any move the engine judges about as good as the solution.
   */
  accept?: 'exact' | 'mate' | 'engine';
  alts?: string[];
  hint?: string;
  success?: string;
}

export interface QuizStep extends StepBase {
  type: 'quiz';
  question: string;
  options: string[];
  answer: number;
  explain: string;
}

/** Play it out against the engine until the goal is met. */
export interface PlayStep extends StepBase {
  type: 'play';
  fen: string;
  goal: 'mate' | 'queen' | 'hold';
  /** Max user moves allowed (mate/queen) or to survive (hold). */
  moves: number;
  success?: string;
}

export type Step = TextStep | MoveStep | QuizStep | PlayStep;

export interface Lesson {
  id: string;
  title: string;
  category: string;
  summary: string;
  steps: Step[];
}
