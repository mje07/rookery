import type { Lesson } from '../../features/lessons/types';

export const tactics: Lesson[] = [
  {
    id: 'hanging',
    title: 'Hanging pieces',
    category: 'Tactics',
    summary: 'Spot undefended pieces: yours and your opponent’s.',
    steps: [
      {
        type: 'text',
        fen: '6k1/5ppp/8/3n4/8/8/5PPP/3R2K1 w - - 0 1',
        squares: ['d5'],
        text: `A piece is **hanging** when it is attacked and not defended. Most games between beginners are decided by hanging pieces, far more often than by deep combinations.

Before every move ask: *What does my opponent's last move attack? Is anything of mine undefended? Is anything of theirs?*`,
      },
      {
        type: 'move',
        fen: '6k1/5ppp/8/3n4/8/8/5PPP/3R2K1 w - - 0 1',
        solution: ['d1d5'],
        text: 'Win the hanging piece.',
        success: 'Free material. Nothing defended the knight.',
      },
      {
        type: 'quiz',
        fen: '6k1/5ppp/4p3/3n4/8/8/5PPP/3R2K1 w - - 0 1',
        question: 'Should White take on d5 now?',
        options: ['Yes, the knight is free', 'No. After Rxd5 exd5 White has given a rook for a knight'],
        answer: 1,
        explain: 'Count attackers and defenders. The e6 pawn defends d5, so Rxd5 exd5 trades a 5-point rook for a 3-point knight.',
        text: 'Now the same idea with one small change.',
      },
    ],
  },
  {
    id: 'forks',
    title: 'Forks',
    category: 'Tactics',
    summary: 'One piece attacks two targets at once.',
    steps: [
      {
        type: 'text',
        fen: 'r3k3/2N5/8/8/8/8/8/4K3 b - - 0 1',
        arrows: [
          { from: 'c7', to: 'e8', color: 'red' },
          { from: 'c7', to: 'a8', color: 'red' },
        ],
        text: `A **fork** is a single move that attacks two (or more) things at once. Your opponent can usually save only one of them.

Knights are famous forkers because they attack in an odd pattern that is easy to overlook. A fork that includes the king (a check) is the strongest kind, since the check *must* be answered.`,
      },
      {
        type: 'move',
        fen: 'r3k3/8/8/3N4/8/8/8/4K3 w - - 0 1',
        solution: ['d5c7', 'e8d7', 'c7a8'],
        text: 'Find the knight fork and win the rook.',
        hint: 'Which square attacks both the king and the rook?',
        success: 'The royal fork: check, then collect the rook.',
      },
      {
        type: 'move',
        fen: '7k/8/2n1n3/8/3P4/8/8/K7 w - - 0 1',
        solution: ['d4d5'],
        text: 'Pawns can fork too. Attack both knights.',
        success: 'Both knights are attacked and only one can escape.',
      },
      {
        type: 'move',
        fen: '7k/rp6/8/8/8/8/8/3Q2K1 w - - 0 1',
        solution: ['d1d4', 'h8g8', 'd4a7'],
        text: 'The queen is a powerful forker. Check the king and hit the rook at the same time.',
        hint: 'Find a square on the long diagonal that also eyes a7.',
      },
    ],
  },
  {
    id: 'pins',
    title: 'Pins',
    category: 'Tactics',
    summary: 'Freeze a piece that shields something more valuable.',
    steps: [
      {
        type: 'text',
        fen: '4k3/8/8/4n3/8/8/8/4R1K1 w - - 0 1',
        arrows: [{ from: 'e1', to: 'e8', color: 'red' }],
        text: `A **pin** attacks a piece that cannot move without exposing a more valuable piece behind it.

If the piece behind is the king, the pin is **absolute**: the pinned piece is not allowed to move at all. Here the knight on e5 is pinned to its king.`,
      },
      {
        type: 'move',
        fen: '4k3/8/8/4n3/8/8/5P2/4R1K1 w - - 0 1',
        solution: ['f2f4', 'e8f7', 'f4e5'],
        text: 'The knight is pinned. Attack it with something it can’t run from.',
        hint: 'A pinned piece is a sitting target for a pawn.',
        success: 'The knight couldn’t move, and by the time the king stepped aside it was too late.',
      },
      {
        type: 'move',
        fen: '4k3/8/8/4q3/8/8/5K2/R7 w - - 0 1',
        solution: ['a1e1', 'e5e1', 'f2e1'],
        text: 'Pin the queen to the king.',
        success: 'Rook for queen is a great trade: +4 points.',
      },
    ],
  },
  {
    id: 'skewers',
    title: 'Skewers',
    category: 'Tactics',
    summary: 'Attack a valuable piece and win what stands behind it.',
    steps: [
      {
        type: 'text',
        fen: '8/8/4q3/8/8/4k3/8/4R1K1 b - - 0 1',
        arrows: [{ from: 'e1', to: 'e6', color: 'red' }],
        text: `A **skewer** is a pin turned around: the *more* valuable piece is in front. When it moves out of the way, the piece behind it falls.

Skewers along a file, rank or diagonal through the king are especially deadly.`,
      },
      {
        type: 'move',
        fen: '8/8/4q3/8/8/4k3/8/R5K1 w - - 0 1',
        solution: ['a1e1', 'e3d3', 'e1e6'],
        text: 'Skewer the king and the queen.',
        hint: 'Check along the e-file.',
      },
      {
        type: 'move',
        fen: '8/8/1q6/8/3k4/8/8/K3B3 w - - 0 1',
        solution: ['e1f2', 'd4d5', 'f2b6'],
        text: 'Bishops skewer along diagonals. Win the queen.',
        hint: 'The king and queen are on the same diagonal.',
      },
    ],
  },
  {
    id: 'discovered',
    title: 'Discovered attacks',
    category: 'Tactics',
    summary: 'Move one piece to unleash another.',
    steps: [
      {
        type: 'text',
        fen: '1q2k3/8/8/4N3/8/8/8/4R1K1 w - - 0 1',
        arrows: [{ from: 'e1', to: 'e8', color: 'blue' }],
        text: `A **discovered attack** happens when a piece moves out of the way and uncovers an attack by the piece behind it.

When the uncovered attack is a check, it's a **discovered check**. The moving piece can then go almost anywhere and attack something else, because your opponent has to deal with the check first.`,
      },
      {
        type: 'move',
        fen: '1q2k3/8/8/4N3/8/8/8/4R1K1 w - - 0 1',
        solution: ['e5c6', 'e8d7', 'c6b8'],
        text: 'Move the knight to uncover a check from the rook, and attack the queen while you do it.',
        hint: 'Which knight move attacks b8?',
        success: 'Discovered check plus an attack on the queen. Black can only deal with one.',
      },
      {
        type: 'quiz',
        question: 'Why is a discovered check so strong?',
        options: [
          'Because the moving piece is protected by the king',
          'Because the opponent must answer the check, so the moving piece’s threat goes unanswered',
          'Because it always leads to checkmate',
        ],
        answer: 1,
        explain: 'Two threats at once, and one of them is a check that must be answered first.',
        text: 'Check your understanding.',
      },
    ],
  },
];
