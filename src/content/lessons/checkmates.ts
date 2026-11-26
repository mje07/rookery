import type { Lesson } from '../../features/lessons/types';

export const checkmates: Lesson[] = [
  {
    id: 'back-rank',
    title: 'Back-rank mate',
    category: 'Checkmate patterns',
    summary: 'The king hemmed in by its own pawns.',
    steps: [
      {
        type: 'text',
        fen: '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1',
        squares: ['f7', 'g7', 'h7'],
        text: `After castling, the king often sits behind a wall of pawns. That wall protects it, but it also **traps** it. A rook or queen on the back rank can then deliver mate.

The cure is a little "luft" (air): a pawn move like h3 or h6 that gives the king an escape square.`,
      },
      {
        type: 'move',
        fen: '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1',
        solution: ['d1d8'],
        accept: 'mate',
        text: 'Deliver back-rank mate.',
      },
      {
        type: 'move',
        fen: '7k/R7/8/8/8/8/8/1R5K w - - 0 1',
        solution: ['b1b8'],
        accept: 'mate',
        text: 'Two rooks working together: one guards the 7th rank, the other mates on the 8th.',
        success: 'This "ladder" pattern also mates a king in the middle of the board, one rank at a time.',
      },
    ],
  },
  {
    id: 'queen-mates',
    title: 'Queen and knight mates',
    category: 'Checkmate patterns',
    summary: 'Supported queen mates and the smothered mate.',
    steps: [
      {
        type: 'text',
        fen: '6k1/6Q1/6K1/8/8/8/8/8 b - - 0 1',
        text: `A queen right next to the enemy king gives mate when it is **protected** (here by the white king) and covers all of the king's escape squares.`,
      },
      {
        type: 'move',
        fen: '6k1/8/6K1/8/8/8/8/Q7 w - - 0 1',
        solution: ['a1g7'],
        accept: 'mate',
        text: 'Find a mate in one.',
        hint: 'Your king can support the queen on g7.',
      },
      {
        type: 'text',
        fen: '6rk/5Npp/8/8/8/8/8/6K1 b - - 0 1',
        text: `The **smothered mate**: the king is completely surrounded by its own pieces, and a knight, which jumps over them, delivers check that can't be blocked.`,
      },
      {
        type: 'move',
        fen: '6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1',
        solution: ['g5f7'],
        accept: 'mate',
        text: 'Smother the king.',
      },
      {
        type: 'move',
        fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
        solution: ['h5f7'],
        accept: 'mate',
        text: 'Black has just defended the e5 pawn with …Nf6?? and missed the real threat. Punish it.',
        hint: 'f7 is protected only by the king, and the bishop on c4 supports your queen.',
        success: 'This four-move mate catches many beginners. Remember the f7 square!',
      },
    ],
  },
];
