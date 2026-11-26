# Rookery

A local, offline chess training app: game review, puzzles, lessons, opening repertoires, bots and an analysis board.
Everything runs in the browser on your machine: Stockfish runs as WebAssembly, and all progress is stored in IndexedDB.

## Run it

```sh
npm install            # also copies Stockfish into public/engine
npm run dev            # http://localhost:5173
```

Production build (fully static, works without a network connection):

```sh
npm run build
npm run preview
```

### Data builds (one-time)

The generated data in `public/data/` is created by two scripts that download open datasets into `data-src/`:

```sh
npm run build:openings   # lichess-org/chess-openings (CC0) → public/data/openings.json
npm run build:puzzles    # Lichess puzzle database (CC0, ~300 MB download) → public/data/puzzles/
```

`build:puzzles` samples ~2,000 puzzles per 100-point rating band plus up to 1,000 per theme
(`PER_BAND` / `PER_THEME` env vars change this).

## The training pipeline (200 → 1000)

The **Today** page is the core of the app: a guided path built around what decides games below 1000.

- **Roadmap: 8 stages**, each targeting one skill: rules & mate-in-1 → not hanging pieces (the blunder check) →
  basic mates → forks → pins/skewers/discoveries → sound openings → converting & endgames → consistency.
  Each stage has **measured gates** (lessons completed, themed puzzles solved at a set accuracy and rating, a bot
  beaten, average blunders per reviewed game, puzzle rating, Rush score) and completes as soon as you meet them, so
  players who already know the basics move through quickly.
- **Daily plan** (20 / 40 / 60 min): warm-up puzzles → mistake review → next lesson → focus puzzles on the stage's
  themes → one slower game against the stage's bot → review of that game. Streaks count days with 3+ tasks done.
- **Mistake trainer**: every mistake, miss and blunder from your reviewed games and every failed puzzle becomes a
  spaced-repetition card. Game positions accept any move the engine rates as close to best.
- **Bot ladder** with small steps (~250, 400, 550, 700, 850, 1000, 1150 …) so there's always a winnable next opponent.
- **Strength estimate**: a rough figure from bots beaten, puzzle rating and roadmap progress. It is shown with "≈"
  because the bots and puzzle ratings are only approximately calibrated to online game ratings.

## Features

| Area | What it does |
| --- | --- |
| **Game Review** | Paste/upload PGN (multi-game files OK). Every position is analysed (MultiPV 2); each move is classified (Brilliant · Great · Best · Excellent · Good · Book · Inaccuracy · Mistake · Miss · Blunder) from expected-points loss, with accuracy per side, a rough rating estimate, explanations, eval graph, key-moment navigation and "retry this move". |
| **Puzzles** | Rated (Glicko-2), 43 themes, Rush (3 min / 3 strikes), Survival, history. |
| **Lessons** | 23 interactive lessons: basics, tactics, mating patterns, endgames played out against the engine, openings, strategy. |
| **Openings** | Explorer over ~3,900 named lines; repertoire builder; spaced-repetition (SM-2) trainer with due reviews and line drills. |
| **Play** | Nine bots (~250 to full strength), optional clocks, hint/takeback; finished games go straight to review. |
| **Analysis** | Live MultiPV engine, variations, PGN/FEN import/export. |

## Development

```sh
npm test               # unit tests + real-engine integration tests (review, lesson content)
npx tsc -b             # typecheck
npm run smoke          # end-to-end screenshots via Playwright (needs `npm run dev -- --port 5199` running)
```

`STEPS=review,puzzles node scripts/smoke.mjs [baseUrl] [outDir]` runs a subset; the run fails on page errors and
reports any request to a non-local host.

Lesson content lives in `src/content/lessons/`. `tests/lessons.test.ts` checks every FEN and solution with
chess.js and verifies with Stockfish that solution moves are sound and play-out positions are winnable/holdable.

## Licenses of bundled components

- Stockfish.js (GPL-3.0), chessground (GPL-3.0): this app is fine for personal use; distributing it means
  following GPL-3.0 terms for the combined work.
- Piece set: cburnett (CC BY-SA 3.0), embedded via chessground.
- Puzzles and opening names: Lichess open databases (CC0).
- Lesson text, bots, UI, icons and classification rules are original to this project.
