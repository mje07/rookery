/**
 * The 200 → 1000 roadmap. Each stage targets the skills that most often decide games at that level,
 * and every gate is measured from what the user actually does in the app.
 */

export type Requirement =
  | { kind: 'lesson'; id: string }
  /** Solve `solved` puzzles tagged with any of `themes` (rated ≥ minRating), with recent accuracy ≥ minAccuracy. */
  | { kind: 'puzzles'; themes: string[]; solved: number; minRating?: number; minAccuracy?: number; label: string }
  | { kind: 'beatBot'; bot: string; wins: number }
  /** Average blunders + misses per game over the last `games` reviewed bot games. */
  | { kind: 'blunders'; max: number; games: number }
  | { kind: 'puzzleRating'; min: number }
  | { kind: 'rush'; min: number };

export interface Stage {
  id: string;
  title: string;
  /** Approximate playing rating this stage takes you from/to. */
  from: number;
  to: number;
  focus: string;
  why: string;
  /** Puzzle themes used for warm-ups and focus sets during this stage. */
  themes: string[];
  bot: string;
  requirements: Requirement[];
}

export const STAGES: Stage[] = [
  {
    id: 'first-steps',
    title: 'First steps',
    from: 200,
    to: 300,
    focus: 'Rules, checkmate, and finishing a game',
    why: 'You can’t win games you don’t know how to finish. Learn how the pieces move and how to deliver mate in one.',
    themes: ['mateIn1'],
    bot: 'pip',
    requirements: [
      { kind: 'lesson', id: 'pieces' },
      { kind: 'lesson', id: 'check-mate' },
      { kind: 'lesson', id: 'special-moves' },
      { kind: 'puzzles', themes: ['mateIn1'], solved: 10, label: 'Mate in 1' },
      { kind: 'beatBot', bot: 'pip', wins: 1 },
    ],
  },
  {
    id: 'stop-hanging',
    title: 'Stop hanging pieces',
    from: 300,
    to: 400,
    focus: 'The blunder check: never give away material for free',
    why: 'At this level most games are lost by leaving pieces undefended. Fixing that alone is worth hundreds of points.',
    themes: ['hangingPiece', 'mateIn1'],
    bot: 'bramble',
    requirements: [
      { kind: 'lesson', id: 'blunder-check' },
      { kind: 'lesson', id: 'hanging' },
      { kind: 'puzzles', themes: ['hangingPiece'], solved: 15, minAccuracy: 70, label: 'Hanging pieces' },
      { kind: 'beatBot', bot: 'bramble', wins: 1 },
      { kind: 'blunders', max: 3, games: 2 },
    ],
  },
  {
    id: 'basic-mates',
    title: 'Basic checkmates',
    from: 400,
    to: 500,
    focus: 'Back-rank mates and mating with queen or rook',
    why: 'Winning positions are worth nothing if you can’t finish them. These mates come up in almost every game.',
    themes: ['mateIn1', 'backRankMate'],
    bot: 'bramble',
    requirements: [
      { kind: 'lesson', id: 'back-rank' },
      { kind: 'lesson', id: 'queen-mates' },
      { kind: 'lesson', id: 'queen-vs-king' },
      { kind: 'lesson', id: 'rook-vs-king' },
      { kind: 'puzzles', themes: ['mateIn1', 'backRankMate'], solved: 20, minRating: 600, label: 'Mating patterns' },
      { kind: 'beatBot', bot: 'bramble', wins: 2 },
    ],
  },
  {
    id: 'forks',
    title: 'Forks & double attacks',
    from: 500,
    to: 600,
    focus: 'Attack two things at once',
    why: 'The fork is the most common tactic in real games. Spot it for you, and against you.',
    themes: ['fork', 'hangingPiece'],
    bot: 'moss',
    requirements: [
      { kind: 'lesson', id: 'forks' },
      { kind: 'puzzles', themes: ['fork'], solved: 20, minAccuracy: 65, label: 'Forks' },
      { kind: 'beatBot', bot: 'moss', wins: 2 },
      { kind: 'blunders', max: 2.5, games: 3 },
    ],
  },
  {
    id: 'pins-skewers',
    title: 'Pins, skewers & discoveries',
    from: 600,
    to: 700,
    focus: 'Line tactics and removing defenders',
    why: 'Once forks are automatic, these are the next tactics that win material.',
    themes: ['pin', 'skewer', 'discoveredAttack', 'capturingDefender'],
    bot: 'fern',
    requirements: [
      { kind: 'lesson', id: 'pins' },
      { kind: 'lesson', id: 'skewers' },
      { kind: 'lesson', id: 'discovered' },
      { kind: 'lesson', id: 'removing-defender' },
      { kind: 'puzzles', themes: ['pin', 'skewer', 'discoveredAttack', 'capturingDefender'], solved: 25, minAccuracy: 60, label: 'Line tactics' },
      { kind: 'puzzleRating', min: 1000 },
      { kind: 'beatBot', bot: 'fern', wins: 2 },
    ],
  },
  {
    id: 'openings',
    title: 'Sound openings',
    from: 700,
    to: 800,
    focus: 'Develop, castle, avoid early traps; mate in two',
    why: 'Get a playable middlegame every game, and stop losing to quick attacks on f7.',
    themes: ['mateIn2', 'opening', 'fork'],
    bot: 'juniper',
    requirements: [
      { kind: 'lesson', id: 'opening-principles' },
      { kind: 'lesson', id: 'early-traps' },
      { kind: 'lesson', id: 'mate-in-two' },
      { kind: 'puzzles', themes: ['mateIn2'], solved: 15, minRating: 800, label: 'Mate in 2' },
      { kind: 'beatBot', bot: 'juniper', wins: 2 },
      { kind: 'blunders', max: 2, games: 3 },
    ],
  },
  {
    id: 'endgames',
    title: 'Converting & endgames',
    from: 800,
    to: 900,
    focus: 'Trade when ahead, king and pawn endings, promotion',
    why: 'Turn your extra material into wins instead of draws or comebacks.',
    themes: ['endgame', 'pawnEndgame', 'promotion', 'advancedPawn'],
    bot: 'cobalt',
    requirements: [
      { kind: 'lesson', id: 'king-pawn' },
      { kind: 'lesson', id: 'trading-ahead' },
      { kind: 'lesson', id: 'pawn-structure' },
      { kind: 'puzzles', themes: ['endgame', 'pawnEndgame', 'promotion', 'advancedPawn'], solved: 20, minRating: 800, label: 'Endgame tactics' },
      { kind: 'puzzleRating', min: 1200 },
      { kind: 'beatBot', bot: 'cobalt', wins: 1 },
    ],
  },
  {
    id: 'consistency',
    title: 'Consistency',
    from: 900,
    to: 1000,
    focus: 'Fewer blunders, faster pattern recognition',
    why: 'At 1000 you rarely hang pieces and you punish opponents who do. This stage proves it.',
    themes: ['fork', 'pin', 'mateIn2', 'hangingPiece', 'discoveredAttack', 'skewer', 'mateIn3'],
    bot: 'cobalt',
    requirements: [
      { kind: 'lesson', id: 'active-pieces' },
      { kind: 'puzzles', themes: ['fork', 'pin', 'skewer', 'discoveredAttack', 'mateIn2', 'mateIn3', 'hangingPiece'], solved: 40, minRating: 1000, minAccuracy: 60, label: 'Mixed tactics at 1000+' },
      { kind: 'puzzleRating', min: 1350 },
      { kind: 'rush', min: 15 },
      { kind: 'beatBot', bot: 'cobalt', wins: 3 },
      { kind: 'blunders', max: 1.2, games: 5 },
    ],
  },
];

export const GOAL_RATING = 1000;
