import type { Lesson } from '../../features/lessons/types';

export const openingsAndStrategy: Lesson[] = [
  {
    id: 'opening-principles',
    title: 'Opening principles',
    category: 'Openings',
    summary: 'Center, development, king safety, in that order.',
    steps: [
      {
        type: 'text',
        fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
        squares: ['d4', 'e4', 'd5', 'e5'],
        text: `You don't need to memorise openings to play them well. Three ideas carry you a long way:

1. **Fight for the center** (d4, e4, d5, e5) with pawns and pieces.
2. **Develop** knights and bishops quickly, usually knights before bishops, and don't move the same piece twice without a reason.
3. **Castle** early to protect your king and connect your rooks.`,
      },
      {
        type: 'move',
        fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
        solution: ['g1f3'],
        accept: 'engine',
        text: 'Make a good developing move.',
        success: 'Good. A move that develops a piece and pressures the center is ideal.',
      },
      {
        type: 'quiz',
        question: 'Which of these is usually a bad idea in the first few moves?',
        options: ['Developing a knight towards the center', 'Bringing the queen out early to grab a pawn', 'Castling'],
        answer: 1,
        explain: 'An early queen gets chased around by developing moves, and your opponent gains time. Develop the minor pieces first.',
        text: 'Spot the mistake.',
      },
      {
        type: 'move',
        fen: 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
        solution: ['e1g1'],
        accept: 'engine',
        text: 'Both sides have developed. Finish your opening sensibly.',
        hint: 'Your king is still in the center.',
      },
    ],
  },
  {
    id: 'early-traps',
    title: 'Early queen attacks',
    category: 'Openings',
    summary: 'Defend against the quick f7 attack, and learn to punish it.',
    steps: [
      {
        type: 'text',
        fen: 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3',
        arrows: [
          { from: 'h5', to: 'f7', color: 'red' },
          { from: 'c4', to: 'f7', color: 'red' },
        ],
        text: `White's queen and bishop are both aiming at **f7**, the weakest square in Black's camp because only the king defends it. White threatens Qxf7 checkmate.`,
      },
      {
        type: 'move',
        fen: 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3',
        solution: ['g7g6'],
        accept: 'engine',
        orientation: 'black',
        text: 'Defend against the mate threat while also defending the e5 pawn.',
        hint: 'Both …g6 and …Qe7 are good.',
        success: 'Safe. Next you can develop with gain of time by attacking the queen.',
      },
      {
        type: 'quiz',
        question: 'Why is bringing the queen out on move 3 risky for White, even though it sets a trap?',
        options: [
          'Because it is illegal before castling',
          'Because Black can develop while attacking the queen, gaining time',
          'Because queens can’t move diagonally in the opening',
        ],
        answer: 1,
        explain: 'Moves like …g6 and …Nf6 come with tempo, and Black ends up ahead in development.',
        text: 'Think about tempo.',
      },
    ],
  },
  {
    id: 'pawn-structure',
    title: 'Pawn structure',
    category: 'Strategy',
    summary: 'Passed, isolated and doubled pawns.',
    steps: [
      {
        type: 'text',
        fen: '6k1/p4ppp/8/1P6/8/2P2P2/2P3PP/6K1 w - - 0 1',
        squares: ['b5', 'c3', 'c2'],
        text: `Pawns can't move backwards, so pawn moves are long-term decisions.

- A **passed pawn** (b5) has no enemy pawns in front of it or on the neighbouring files. It is a constant threat to promote.
- **Doubled pawns** (c2, c3) sit on the same file and can't protect each other.
- An **isolated pawn** has no friendly pawns on neighbouring files, so only pieces can defend it.`,
      },
      {
        type: 'quiz',
        fen: '6k1/p4ppp/8/1P6/8/2P2P2/2P3PP/6K1 w - - 0 1',
        question: 'Which White pawn is passed?',
        options: ['b5', 'c3', 'f3', 'h2'],
        answer: 0,
        explain: 'No black pawn stands on the a-, b- or c-file in front of b5. (The a7 pawn is behind it, so it can’t stop it.)',
        text: 'Find the passer.',
      },
      {
        type: 'quiz',
        question: 'Which pawn weakness is described: "no friendly pawns on either neighbouring file"?',
        options: ['Doubled pawn', 'Isolated pawn', 'Backward pawn'],
        answer: 1,
        explain: 'An isolated pawn can only be defended by pieces, and the square in front of it is a natural outpost for the opponent.',
        text: 'Terminology check.',
      },
    ],
  },
  {
    id: 'active-pieces',
    title: 'Active pieces',
    category: 'Strategy',
    summary: 'Open files, outposts and good vs bad bishops.',
    steps: [
      {
        type: 'text',
        fen: '2r3k1/5ppp/p3p3/1p1nN3/3P4/P5P1/1P3P1P/2R3K1 w - - 0 1',
        squares: ['e5', 'd5', 'c1', 'c8'],
        text: `A piece is **active** when it controls many squares and takes part in the fight.

- **Rooks** belong on open files (with no pawns), like the c-file here.
- An **outpost** is a square that enemy pawns can no longer attack. A knight on e5 or d5 is a monster.
- A bishop blocked by its own pawns on squares of its colour is a **bad bishop**.`,
      },
      {
        type: 'quiz',
        question: 'Your rook is stuck behind your own pawns. What is usually the best plan?',
        options: ['Leave it there for defence', 'Move it to an open or half-open file', 'Trade it for a knight'],
        answer: 1,
        explain: 'Rooks need open lines. Doubling rooks on an open file, or reaching the 7th rank, often decides games.',
        text: 'Plans over moves.',
      },
    ],
  },
];
