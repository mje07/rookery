import type { Lesson } from '../../features/lessons/types';

export const endgames: Lesson[] = [
  {
    id: 'queen-vs-king',
    title: 'Checkmate with king and queen',
    category: 'Endgames',
    summary: 'Push the king to the edge, avoid stalemate, finish.',
    steps: [
      {
        type: 'text',
        fen: '8/8/8/4k3/8/8/8/3QK3 w - - 0 1',
        text: `With king and queen against a lone king you can always force mate, but you need a plan:

1. Use the queen to **box** the king in, a knight's move away from it, shrinking its area each move.
2. When the king reaches the edge, **stop** and bring your own king closer. This is where stalemate traps lurk.
3. Mate with the queen next to the king, protected by your king (or on the edge rank).`,
      },
      {
        type: 'text',
        fen: '8/8/8/4k3/8/2Q5/8/4K3 b - - 0 1',
        squares: ['d4', 'c4', 'b4', 'a4', 'c5', 'c6', 'c7', 'c8', 'd3', 'e3', 'f3', 'g3', 'h3'],
        text: `For example, a queen on c3 keeps the black king out of the c-file and off the 3rd rank. Each time the king steps back, follow with the queen, keeping that knight's-move distance.`,
      },
      {
        type: 'play',
        fen: '8/8/8/4k3/8/8/8/3QK3 w - - 0 1',
        goal: 'mate',
        moves: 20,
        text: 'Now checkmate the engine’s king within 20 moves. Watch out for stalemate!',
        success: 'Checkmate! You have mastered the most important basic mate.',
      },
    ],
  },
  {
    id: 'rook-vs-king',
    title: 'Checkmate with king and rook',
    category: 'Endgames',
    summary: 'The rook needs its king’s help: use opposition and waiting moves.',
    steps: [
      {
        type: 'text',
        fen: '8/8/8/4k3/8/8/8/R3K3 w - - 0 1',
        text: `A rook alone can't mate. It needs the king. The method:

1. Use the rook to **cut off** the enemy king along a rank or file.
2. Walk your king up so the two kings face each other (the **opposition**), then give check with the rook. The king must retreat one rank.
3. If the kings are not facing each other, make a **waiting move** with the rook along its line.

Repeat until the king is on the edge, then mate.`,
      },
      {
        type: 'move',
        fen: '4k3/8/4K3/8/8/8/8/7R w - - 0 1',
        solution: ['h1h8'],
        accept: 'mate',
        text: 'The kings face each other. Deliver the final check.',
      },
      {
        type: 'play',
        fen: '8/8/8/4k3/8/8/8/R3K3 w - - 0 1',
        goal: 'mate',
        moves: 35,
        text: 'Now from scratch: checkmate within 35 moves.',
        success: 'Well done! That technique takes practice.',
      },
    ],
  },
  {
    id: 'king-pawn',
    title: 'King and pawn: the opposition',
    category: 'Endgames',
    summary: 'When a lone pawn wins, and when it doesn’t.',
    steps: [
      {
        type: 'text',
        fen: '4k3/8/4K3/4P3/8/8/8/8 b - - 0 1',
        text: `In king-and-pawn endings the kings fight for key squares. Two kings standing face to face with one square between them are in **opposition**. Whoever has to move must give way.

A useful rule: if your king reaches the **6th rank in front of its pawn** (for White), the pawn wins, no matter who is to move.`,
      },
      {
        type: 'quiz',
        fen: '4k3/8/8/4K3/4P3/8/8/8 b - - 0 1',
        question: 'Black to move. Can Black hold the draw?',
        options: ['Yes, by taking the opposition with …Ke7', 'No, White always wins with an extra pawn'],
        answer: 0,
        explain: 'After …Ke7 the kings face each other and White must give way. Black keeps opposing the white king and reaches a drawn position. With White to move here, Ke6 would win instead.',
        text: 'Timing is everything.',
      },
      {
        type: 'play',
        fen: '4k3/8/4K3/4P3/8/8/8/8 w - - 0 1',
        goal: 'queen',
        moves: 12,
        text: 'Your king is on the 6th rank in front of the pawn. Promote and keep your new queen.',
        success: 'A new queen! Leading with the king made it possible.',
      },
      {
        type: 'quiz',
        fen: '8/8/8/8/k7/8/7P/7K w - - 0 1',
        question: 'White to move. Can the black king catch the h-pawn?',
        options: ['Yes', 'No. The king is outside the pawn’s "square"'],
        answer: 1,
        explain: 'After h2-h4 the pawn’s "square" runs from h4 to d8. The black king on a4 can’t step inside it, so it can’t catch the pawn: the pawn needs 5 moves to queen, the king at least 7 to reach h8.',
        text: 'The rule of the square.',
      },
    ],
  },
  {
    id: 'lucena',
    title: 'Rook endgame: building a bridge',
    category: 'Endgames',
    summary: 'The key winning position with rook and pawn against rook.',
    steps: [
      {
        type: 'text',
        fen: '1K1k4/1P6/8/8/8/8/r7/2R5 w - - 0 1',
        text: `White's pawn is about to promote, but the king is stuck in front of it and Black's rook checks from the side. The winning plan has three moves to remember:

1. **Check** the enemy king one file further away (Rd1+).
2. Bring your rook to the **4th rank** (Rd4!). This is the "bridge".
3. Walk your king out. When the checks come, block with the rook on the 4th rank.`,
      },
      {
        type: 'play',
        fen: '1K1k4/1P6/8/8/8/8/r7/2R5 w - - 0 1',
        goal: 'queen',
        moves: 15,
        text: 'Win it against the engine: promote and keep the queen.',
        success: 'You built the bridge. This position comes up again and again in rook endgames.',
      },
    ],
  },
  {
    id: 'philidor',
    title: 'Rook endgame: the third-rank defence',
    category: 'Endgames',
    summary: 'Hold the draw a pawn down by keeping your rook active.',
    steps: [
      {
        type: 'text',
        orientation: 'black',
        fen: '4k3/R7/1r6/4PK2/8/8/8/8 b - - 0 1',
        squares: ['a6', 'b6', 'c6', 'd6', 'e6', 'f6', 'g6', 'h6'],
        text: `You are a pawn down. Keep your king in front of the pawn and your rook on your **third rank** (here the 6th), so White's king can't come forward.

When White finally pushes the pawn to the 6th, the king loses its shelter. Then swing your rook back and check from behind, from far away.`,
      },
      {
        type: 'play',
        orientation: 'black',
        fen: '4k3/R7/1r6/4PK2/8/8/8/8 b - - 0 1',
        goal: 'hold',
        moves: 12,
        text: 'Hold the draw for 12 moves against the engine.',
        success: 'Draw secured. Defending a pawn down is a skill that saves half-points.',
      },
    ],
  },
];
