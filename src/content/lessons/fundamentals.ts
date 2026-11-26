import type { Lesson } from '../../features/lessons/types';

export const fundamentals: Lesson[] = [
  {
    id: 'blunder-check',
    title: 'The blunder check',
    category: 'Habits',
    summary: 'A three-question routine before every move. The single biggest rating booster below 1000.',
    steps: [
      {
        type: 'text',
        text: `Most games under 1000 aren't decided by deep plans. They're decided by a piece left hanging or a threat that went unnoticed. A short routine, done **every move**, fixes most of that:

1. **What did my opponent's last move change?** What does that piece attack now? Is there a threat?
2. **Checks, captures, threats.** Look at every check and capture you have (and every threat you can make) before anything else.
3. **Before you let go of the piece:** after my move, what can they take, and what checks do they have? Is anything of mine undefended?

It feels slow at first. After a couple of weeks it becomes automatic.`,
      },
      {
        type: 'move',
        fen: 'r1bqkbnr/pppp1ppp/2n5/8/3QP3/8/PPP2PPP/RNB1KBNR w KQkq - 1 4',
        solution: ['d4e3'],
        accept: 'engine',
        text: 'Question 1: your opponent just played …Nc6. What did that change? Respond to it.',
        hint: 'The knight attacks your queen. Move it to a safe square.',
        success: 'Exactly. Always ask what the last move attacks before making your own plans.',
      },
      {
        type: 'move',
        fen: '4k3/8/8/3b4/8/2N5/8/4K3 w - - 0 1',
        solution: ['c3d5'],
        text: 'Question 2: checks, captures, threats. Is there a free capture?',
        success: 'Captures first! Nothing defended the bishop.',
      },
      {
        type: 'quiz',
        fen: 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 1 5',
        question: 'White is thinking about Ng5, attacking f7. What should White check before playing it?',
        options: [
          'Nothing. Attacking moves are always good',
          'After Ng5, can Black capture the knight or ignore the threat with a stronger one?',
          'Whether the knight is on a light or dark square',
        ],
        answer: 1,
        explain: 'Question 3: before you let go, look at your opponent’s replies to your move: captures, checks and counter-threats. Many “attacks” just hang the attacking piece.',
        text: 'The last question is the one people skip.',
      },
      {
        type: 'quiz',
        question: 'In what order should you scan your candidate moves?',
        options: ['Quiet moves, then captures, then checks', 'Checks, captures, then threats', 'Whatever looks most natural'],
        answer: 1,
        explain: 'Checks, captures and threats are the forcing moves. They are the ones most likely to win, or to lose, material immediately.',
        text: 'One more time, so it sticks.',
      },
    ],
  },
  {
    id: 'removing-defender',
    title: 'Removing the defender',
    category: 'Tactics',
    summary: 'If a piece has only one defender, take the defender.',
    steps: [
      {
        type: 'text',
        fen: '6k1/5ppp/5n2/3b2B1/8/8/5PPP/3R2K1 w - - 0 1',
        arrows: [
          { from: 'd1', to: 'd5', color: 'red' },
          { from: 'f6', to: 'd5', color: 'blue' },
        ],
        text: `Your rook attacks the bishop on d5, but the knight on f6 defends it. Count **attackers vs defenders**: one each, so taking now just trades a rook for a bishop.

But a defender is also a target. If you remove the defender first, the piece it was guarding is left hanging.`,
      },
      {
        type: 'move',
        fen: '6k1/5ppp/5n2/3b2B1/8/8/5PPP/3R2K1 w - - 0 1',
        solution: ['g5f6', 'g7f6', 'd1d5'],
        text: 'Remove the defender, then collect the bishop.',
        hint: 'Your bishop can capture the knight.',
        success: 'A piece up. Black couldn’t save both.',
      },
      {
        type: 'quiz',
        question: 'A black rook is defended only by a knight. Your bishop can capture that knight. What usually happens?',
        options: [
          'Nothing. Capturing defenders never works',
          'After you take the knight, the rook is left without protection',
          'Your bishop is always lost',
        ],
        answer: 1,
        explain: 'Every time you see “this piece is defended once”, look for a way to capture, deflect or distract that single defender.',
        text: 'Generalise the idea.',
      },
    ],
  },
  {
    id: 'mate-in-two',
    title: 'Mate in two',
    category: 'Checkmate patterns',
    summary: 'Forcing sequences: a quiet cutting move, and a sacrifice that sets up a smothered mate.',
    steps: [
      {
        type: 'text',
        text: `Many mates take two moves: the first forces or restricts, the second finishes. Look at **forcing** first moves (checks and captures), and at quiet moves that take away the last escape squares.`,
      },
      {
        type: 'move',
        fen: '6k1/8/8/8/8/8/R7/1R4K1 w - - 0 1',
        solution: ['a2a7', 'g8f8', 'b1b8'],
        accept: 'mate',
        text: 'Mate in two with the rooks. First take away a whole rank.',
        hint: 'Put one rook on the 7th rank so the king is stuck on the 8th.',
        success: 'The ladder: one rook cuts off, the other mates.',
      },
      {
        type: 'move',
        fen: 'r6k/6pp/7N/8/8/1Q6/6PP/6K1 w - - 0 1',
        solution: ['b3g8', 'a8g8', 'h6f7'],
        accept: 'mate',
        text: 'Mate in two. It starts with a queen sacrifice!',
        hint: 'Check on g8. The king can’t take, because your knight guards g8.',
        success: 'A smothered mate: the rook that captured your queen now blocks its own king.',
      },
    ],
  },
  {
    id: 'trading-ahead',
    title: 'Winning when you’re ahead',
    category: 'Strategy',
    summary: 'Trade pieces, push passed pawns, keep it simple.',
    steps: [
      {
        type: 'text',
        text: `Getting an advantage is half the job. Converting it is the other half. When you're ahead in material:

- **Trade pieces, not pawns.** Each trade makes your extra material count for more, and your opponent has fewer ways to trick you.
- **Stay safe.** Keep doing your blunder check. Most thrown-away wins come from rushing.
- **Make a passed pawn** and push it, supported by your pieces and king.`,
      },
      {
        type: 'quiz',
        question: 'You are a knight up. Your opponent offers a queen trade. Should you usually accept?',
        options: ['Yes. Trading pieces helps the side that is ahead', 'No. Keep queens on to attack the king', 'It doesn’t matter'],
        answer: 0,
        explain: 'With fewer pieces on the board, an extra knight decides the game more easily, and there are fewer tactics for your opponent to find.',
        text: 'A common decision.',
      },
      {
        type: 'play',
        fen: '6k1/5pp1/7p/8/8/8/5PPP/R5K1 w - - 0 1',
        goal: 'queen',
        moves: 40,
        text: 'You are a rook up. Convert it: make a new queen and keep it. Use your rook and king to support a passed pawn.',
        success: 'Converted! Patient, safe moves win won positions.',
      },
    ],
  },
];
