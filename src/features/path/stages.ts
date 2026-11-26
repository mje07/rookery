/**
 * The full curriculum, from first moves to ~2200. A user's roadmap is the slice of stages between their current
 * rating and their goal (see `pathStages`). Each stage targets the skills that most often decide games at that
 * level, and every gate is measured from what the user actually does in the app.
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

export const MIN_RATING = 100;
export const MAX_RATING = 2200;

const TACTICS_MIX = ['fork', 'pin', 'skewer', 'discoveredAttack', 'mateIn2', 'mateIn3', 'hangingPiece', 'deflection', 'attraction'];

export const STAGES: Stage[] = [
  {
    id: 'first-steps',
    title: 'First steps',
    from: 100,
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
    why: 'Around 1000 you rarely hang pieces and you punish opponents who do. This stage proves it.',
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
  {
    id: 'combinations',
    title: 'Combinations',
    from: 1000,
    to: 1150,
    focus: 'Deflection, attraction and three-move mates',
    why: 'Beyond single tactics, games are won by combining them: lure a piece, then strike.',
    themes: ['deflection', 'attraction', 'mateIn3', 'sacrifice', 'capturingDefender'],
    bot: 'otto',
    requirements: [
      { kind: 'puzzles', themes: ['deflection', 'attraction', 'mateIn3', 'sacrifice'], solved: 40, minRating: 1200, minAccuracy: 60, label: 'Combinations at 1200+' },
      { kind: 'puzzleRating', min: 1500 },
      { kind: 'beatBot', bot: 'otto', wins: 2 },
      { kind: 'blunders', max: 1, games: 5 },
    ],
  },
  {
    id: 'rook-endgames',
    title: 'Rook endgames',
    from: 1150,
    to: 1300,
    focus: 'The winning bridge, the drawing defence, active rooks',
    why: 'Rook endgames are the most common endgames. Knowing two key positions turns losses into draws and draws into wins.',
    themes: ['rookEndgame', 'endgame', 'advancedPawn'],
    bot: 'sable',
    requirements: [
      { kind: 'lesson', id: 'lucena' },
      { kind: 'lesson', id: 'philidor' },
      { kind: 'puzzles', themes: ['rookEndgame', 'endgame'], solved: 30, minRating: 1200, minAccuracy: 55, label: 'Endgames at 1200+' },
      { kind: 'puzzleRating', min: 1600 },
      { kind: 'beatBot', bot: 'sable', wins: 2 },
    ],
  },
  {
    id: 'attack-defence',
    title: 'Attack & defence',
    from: 1300,
    to: 1450,
    focus: 'Kingside attacks, defensive moves, in-between moves',
    why: 'Stronger opponents don’t blunder outright. You have to create threats, and find the only defence when they do.',
    themes: ['kingsideAttack', 'exposedKing', 'defensiveMove', 'intermezzo', 'clearance'],
    bot: 'wren',
    requirements: [
      { kind: 'puzzles', themes: ['kingsideAttack', 'exposedKing', 'defensiveMove', 'intermezzo', 'clearance'], solved: 40, minRating: 1400, minAccuracy: 55, label: 'Attack & defence at 1400+' },
      { kind: 'puzzleRating', min: 1700 },
      { kind: 'rush', min: 20 },
      { kind: 'beatBot', bot: 'wren', wins: 2 },
    ],
  },
  {
    id: 'quiet-moves',
    title: 'Quiet moves & positional play',
    from: 1450,
    to: 1600,
    focus: 'Quiet moves, zugzwang, trapped pieces, pawn structure',
    why: 'The best move is often not a capture or a check. Learn to find the quiet move that wins.',
    themes: ['quietMove', 'zugzwang', 'trappedPiece', 'xRayAttack', 'interference'],
    bot: 'ember',
    requirements: [
      { kind: 'puzzles', themes: ['quietMove', 'zugzwang', 'trappedPiece', 'xRayAttack', 'interference'], solved: 40, minRating: 1550, minAccuracy: 55, label: 'Quiet moves at 1550+' },
      { kind: 'puzzleRating', min: 1850 },
      { kind: 'beatBot', bot: 'ember', wins: 2 },
      { kind: 'blunders', max: 0.8, games: 5 },
    ],
  },
  {
    id: 'deep-calculation',
    title: 'Deep calculation',
    from: 1600,
    to: 1800,
    focus: 'Long forcing lines and sacrifices',
    why: 'Calculating four or five moves deep, accurately, separates club players from strong club players.',
    themes: ['long', 'veryLong', 'mateIn3', 'sacrifice', ...TACTICS_MIX],
    bot: 'basil',
    requirements: [
      { kind: 'puzzles', themes: ['long', 'veryLong', 'mateIn3', 'sacrifice'], solved: 50, minRating: 1750, minAccuracy: 55, label: 'Long combinations at 1750+' },
      { kind: 'puzzleRating', min: 2000 },
      { kind: 'rush', min: 25 },
      { kind: 'beatBot', bot: 'basil', wins: 2 },
    ],
  },
  {
    id: 'expert-technique',
    title: 'Expert technique',
    from: 1800,
    to: 2000,
    focus: 'Precise endgames and accurate defence under pressure',
    why: 'At this level, games are decided by small mistakes. Clean technique and stubborn defence win points.',
    themes: ['rookEndgame', 'queenEndgame', 'pawnEndgame', 'defensiveMove', 'veryLong', 'quietMove'],
    bot: 'onyx',
    requirements: [
      { kind: 'puzzles', themes: ['rookEndgame', 'queenEndgame', 'pawnEndgame', 'bishopEndgame', 'knightEndgame', 'defensiveMove'], solved: 50, minRating: 1900, minAccuracy: 55, label: 'Technique at 1900+' },
      { kind: 'puzzleRating', min: 2150 },
      { kind: 'beatBot', bot: 'onyx', wins: 2 },
      { kind: 'blunders', max: 0.5, games: 5 },
    ],
  },
  {
    id: 'mastery',
    title: 'Mastery',
    from: 2000,
    to: 2200,
    focus: 'Master-level patterns, speed and consistency',
    why: 'Beat a 2200-strength opponent repeatedly and solve master-game puzzles quickly and reliably.',
    themes: ['master', 'veryLong', 'quietMove', 'sacrifice', ...TACTICS_MIX],
    bot: 'quill',
    requirements: [
      { kind: 'puzzles', themes: ['master', 'veryLong', 'quietMove', 'sacrifice', 'deflection'], solved: 60, minRating: 2100, minAccuracy: 55, label: 'Master puzzles at 2100+' },
      { kind: 'puzzleRating', min: 2300 },
      { kind: 'rush', min: 30 },
      { kind: 'beatBot', bot: 'quill', wins: 2 },
    ],
  },
];

export function clampRating(r: number) {
  return Math.max(MIN_RATING, Math.min(MAX_RATING, Math.round(r)));
}

/** Stages between the current rating and the goal (inclusive of the stage containing each end). */
export function pathStages(start: number, goal: number): Stage[] {
  const s = clampRating(start);
  const g = Math.max(clampRating(goal), s + 50);
  const out = STAGES.filter((st) => st.to > s && st.from < g);
  return out.length ? out : [STAGES[STAGES.length - 1]];
}
