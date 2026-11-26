import type { Lesson } from '../../features/lessons/types';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export const basics: Lesson[] = [
  {
    id: 'pieces',
    title: 'How the pieces move',
    category: 'Basics',
    summary: 'Rook, bishop, knight, queen, king and pawn: how each one moves and what it is worth.',
    steps: [
      {
        type: 'text',
        fen: START,
        text: `Chess is played on an 8×8 board. White moves first, then the players take turns, one move at a time.

Each side starts with 16 pieces: a king, a queen, two rooks, two bishops, two knights and eight pawns. You win by **checkmating** the enemy king.`,
      },
      {
        type: 'text',
        fen: '7k/8/8/8/3R4/8/8/K7 w - - 0 1',
        arrows: [
          { from: 'd4', to: 'd8' },
          { from: 'd4', to: 'd1' },
          { from: 'd4', to: 'a4' },
          { from: 'd4', to: 'h4' },
        ],
        text: `The **rook** moves any number of squares in a straight line, up, down or sideways. It can't jump over pieces.

It captures by landing on an enemy piece.`,
      },
      {
        type: 'move',
        fen: '7k/p7/8/8/8/8/8/R6K w - - 0 1',
        solution: ['a1a7'],
        text: 'Capture the black pawn with your rook.',
        hint: 'The rook can slide all the way up the a-file.',
        success: 'Rooks are strongest on open lines like this one.',
      },
      {
        type: 'text',
        fen: '7k/8/8/8/3B4/8/8/K7 w - - 0 1',
        arrows: [
          { from: 'd4', to: 'a7' },
          { from: 'd4', to: 'h8' },
          { from: 'd4', to: 'a1' },
          { from: 'd4', to: 'g1' },
        ],
        text: `The **bishop** moves diagonally, any number of squares. It always stays on squares of one colour, so each side has a "light-squared" and a "dark-squared" bishop.`,
      },
      {
        type: 'move',
        fen: '7k/8/8/8/8/2p5/8/B6K w - - 0 1',
        solution: ['a1c3'],
        text: 'Capture the pawn with your bishop.',
      },
      {
        type: 'text',
        fen: '7k/8/8/8/3N4/8/8/K7 w - - 0 1',
        squares: ['c6', 'e6', 'b5', 'f5', 'b3', 'f3', 'c2', 'e2'],
        text: `The **knight** moves in an "L": two squares one way, then one square to the side. It is the only piece that can **jump over** other pieces.

A knight always lands on a square of the opposite colour to the one it started on.`,
      },
      {
        type: 'move',
        fen: '7k/8/8/8/8/5p2/8/6NK w - - 0 1',
        solution: ['g1f3'],
        text: 'Jump with the knight and capture the pawn.',
      },
      {
        type: 'text',
        fen: '7k/8/8/8/3Q4/8/8/K7 w - - 0 1',
        text: `The **queen** combines the rook and the bishop: any number of squares in any straight line or diagonal. It is by far the most powerful piece.

The **king** moves one square in any direction. It can never move into check.`,
      },
      {
        type: 'move',
        fen: '7k/3r4/8/7b/8/8/8/3Q3K w - - 0 1',
        solution: ['d1d7'],
        text: 'Your queen can capture two different pieces. Take the more valuable one.',
        hint: 'A rook is worth more than a bishop.',
        success: 'Right. The rook is worth about 5 points, the bishop about 3.',
      },
      {
        type: 'text',
        fen: '7k/8/8/8/8/8/4P3/K7 w - - 0 1',
        arrows: [
          { from: 'e2', to: 'e3' },
          { from: 'e2', to: 'e4', color: 'blue' },
        ],
        text: `**Pawns** move straight forward one square. On its first move a pawn may move two squares. Pawns capture **diagonally** forward, one square.

When a pawn reaches the last rank it **promotes** and becomes a queen, rook, bishop or knight (almost always a queen).`,
      },
      {
        type: 'move',
        fen: '7k/P7/8/8/8/8/8/7K w - - 0 1',
        solution: ['a7a8q'],
        alts: ['a7a8r'],
        text: 'Push the pawn to the last rank and promote it to a queen.',
        success: 'A new queen, and it gives check too!',
      },
      {
        type: 'quiz',
        question: 'Roughly how many points is each piece worth?',
        options: [
          'Pawn 1 · Knight 3 · Bishop 3 · Rook 5 · Queen 9',
          'Pawn 1 · Knight 2 · Bishop 4 · Rook 6 · Queen 10',
          'All pieces except the king are worth the same',
        ],
        answer: 0,
        explain: 'These values are a guide for trades. A knight for a bishop is usually even; giving a rook for a knight loses about 2 points.',
        text: 'Quick check on piece values.',
      },
    ],
  },
  {
    id: 'check-mate',
    title: 'Check, checkmate and stalemate',
    category: 'Basics',
    summary: 'How a game is won, and the one way a winning position can be thrown away.',
    steps: [
      {
        type: 'text',
        fen: '4k3/8/8/8/8/8/3q4/4K3 w - - 0 1',
        text: `When a king is attacked it is in **check**. The player in check must get out of it immediately, in one of three ways:

1. move the king,
2. block the attack, or
3. capture the attacking piece.`,
      },
      {
        type: 'move',
        fen: '4k3/8/8/8/8/8/3q4/4K3 w - - 0 1',
        solution: ['e1d2'],
        text: 'Your king is in check from the queen. Find the best way out.',
        hint: 'Is the queen protected?',
        success: 'The queen was unprotected, so your king simply captures it.',
      },
      {
        type: 'quiz',
        fen: 'R5k1/5ppp/8/8/8/8/8/6K1 b - - 0 1',
        question: 'Black to move. What is the situation?',
        options: ['Black is in check but can escape', 'Checkmate. White wins', 'Stalemate. It’s a draw'],
        answer: 1,
        explain: 'The rook attacks the king, and every escape square is either covered by the rook or blocked by Black’s own pawns. Nothing can block or capture. That is **checkmate**.',
        text: 'If the king is in check and there is no way out, it is **checkmate** and the game is over.',
      },
      {
        type: 'move',
        fen: '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1',
        solution: ['a1a8'],
        accept: 'mate',
        text: 'Now you try. Deliver checkmate in one move.',
        hint: 'Black’s pawns trap their own king on the back rank.',
      },
      {
        type: 'quiz',
        fen: '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1',
        question: 'Black to move. What is the result?',
        options: ['Checkmate. White wins', 'Stalemate. It’s a draw', 'Black can play Kg8'],
        answer: 1,
        explain: 'Black is **not** in check, but has no legal move: every king move walks into an attack. That is **stalemate**, and the game is a draw, even though White is a queen up.',
        text: 'Careful with a big material lead!',
      },
      {
        type: 'move',
        fen: '7k/8/6K1/8/8/8/8/5Q2 w - - 0 1',
        solution: ['f1f8'],
        accept: 'mate',
        text: 'Checkmate in one, without giving stalemate.',
        hint: 'Check along the back rank. Your king already covers g7 and h7.',
        success: 'Checkmate! Notice that Qf7 here would have been stalemate.',
      },
    ],
  },
  {
    id: 'special-moves',
    title: 'Special moves',
    category: 'Basics',
    summary: 'Castling, en passant and promotion.',
    steps: [
      {
        type: 'text',
        fen: 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1',
        arrows: [
          { from: 'e1', to: 'g1' },
          { from: 'h1', to: 'f1', color: 'blue' },
        ],
        text: `**Castling** is a king move that also moves a rook: the king goes two squares towards a rook, and the rook jumps to the other side of the king.

You may castle only if neither piece has moved, the squares between them are empty, and the king is not in check, does not pass through check, and does not land in check.`,
      },
      {
        type: 'move',
        fen: 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1',
        solution: ['e1g1'],
        alts: ['e1c1'],
        text: 'Castle. Move your king two squares towards a rook.',
        success: 'Castled. Your king is safer in the corner and your rook comes into play.',
      },
      {
        type: 'text',
        fen: '7k/8/8/3pP3/8/8/8/7K w - d6 0 1',
        arrows: [{ from: 'e5', to: 'd6' }],
        text: `**En passant**: if a pawn advances two squares and lands right beside an enemy pawn, that enemy pawn may capture it *as if it had moved only one square*.

You must do it immediately, on the very next move, or the chance is gone. Here Black has just played …d7-d5.`,
      },
      {
        type: 'move',
        fen: '7k/8/8/3pP3/8/8/8/7K w - d6 0 1',
        solution: ['e5d6'],
        text: 'Capture en passant.',
        success: 'The d5 pawn is removed even though your pawn landed on d6.',
      },
      {
        type: 'quiz',
        question: 'When can a pawn promote?',
        options: ['When it captures a piece', 'When it reaches the last rank', 'After it has moved five times'],
        answer: 1,
        explain: 'A pawn that reaches the far rank must be exchanged for a queen, rook, bishop or knight of the same colour.',
        text: 'One more rule.',
      },
    ],
  },
];
