// End-to-end smoke test: drives the running app in headless Chromium and saves screenshots.
// Usage: npm run dev -- --port 5199   (in another shell), then: node scripts/smoke.mjs [baseUrl] [outDir]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const base = process.argv[2] ?? 'http://localhost:5199';
const out = process.argv[3] ?? 'smoke-out';
mkdirSync(out, { recursive: true });

const OPERA = `[White "Paul Morphy"]
[Black "Duke Karl / Count Isouard"]
[Result "1-0"]

1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7
8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7
14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
page.on('request', (r) => { const u = new URL(r.url()); if (!['localhost', '127.0.0.1'].includes(u.hostname) && !u.protocol.startsWith('data') && !u.protocol.startsWith('blob')) errors.push(`external request: ${r.url()}`); });
const shot = (name) => page.screenshot({ path: join(out, `${name}.png`) });
const steps = (process.env.STEPS ?? 'home,analysis,review').split(',');

if (steps.includes('home')) {
  await page.goto(`${base}/#/`);
  await page.waitForTimeout(800);
  await shot('home');
}

if (steps.includes('analysis')) {
  await page.goto(`${base}/#/analysis`);
  await page.waitForSelector('.engine-line', { timeout: 20000 });
  // play e2-e4 by clicking squares
  const board = await page.locator('cg-board').boundingBox();
  const sq = (file, rank) => ({ x: board.x + (file + 0.5) * (board.width / 8), y: board.y + (8 - rank + 0.5) * (board.height / 8) });
  for (const [f, r] of [[4, 2], [4, 4]]) await page.mouse.click(sq(f, r).x, sq(f, r).y);
  await page.waitForTimeout(1500);
  await shot('analysis');
}

if (steps.includes('review')) {
  await page.goto(`${base}/#/review`);
  await page.fill('textarea', OPERA);
  await page.click('button:has-text("Review")');
  await page.waitForSelector('.review-summary', { timeout: 120000 });
  await shot('review-summary');
  for (let i = 0; i < 31; i++) await page.keyboard.press('ArrowRight'); // to 16.Qb8+
  await page.waitForTimeout(500);
  await shot('review-qb8');
  await page.click('button:has-text("Key moment")');
  await page.waitForTimeout(300);
  await page.keyboard.press('Home');
  await page.click('button:has-text("Key moment ▶")');
  await page.waitForTimeout(400);
  await shot('review-keymoment');
}

// Click-move helper: squares like 'e2' -> 'e4' (board orientation aware).
async function clickMove(from, to) {
  const flipped = await page.locator('.cg-wrap.orientation-black').count();
  const b = await page.locator('cg-board').boundingBox();
  const pt = (sq) => {
    let f = sq.charCodeAt(0) - 97;
    let r = Number(sq[1]);
    if (flipped) {
      f = 7 - f;
      r = 9 - r;
    }
    return { x: b.x + (f + 0.5) * (b.width / 8), y: b.y + (8 - r + 0.5) * (b.height / 8) };
  };
  for (const sq of [from, to]) await page.mouse.click(pt(sq).x, pt(sq).y);
}

if (steps.includes('play')) {
  await page.goto(`${base}/#/play`);
  await page.click('button.card:has-text("Pip")');
  await page.click('button:has-text("Play Pip")');
  await page.waitForSelector('cg-board');
  await clickMove('e2', 'e4');
  await page.waitForFunction(() => document.querySelectorAll('.move-list .mv').length >= 2, null, { timeout: 20000 });
  await clickMove('d2', 'd4');
  await page.waitForFunction(() => document.querySelectorAll('.move-list .mv').length >= 4, null, { timeout: 20000 });
  await shot('play');
  await page.click('button:has-text("Resign")');
  await page.click('button:has-text("Review this game")');
  await page.waitForSelector('.review-summary', { timeout: 60000 });
  await shot('play-review');
}

if (steps.includes('puzzles')) {
  await page.goto(`${base}/#/puzzles`);
  await page.waitForSelector('.rating-big', { timeout: 20000 });
  await page.waitForTimeout(1200);
  await shot('puzzle');
  await page.click('button:has-text("Solution")');
  await page.waitForSelector('button:has-text("Next puzzle")', { timeout: 20000 });
  await shot('puzzle-solved');
  await page.goto(`${base}/#/puzzles/themes`);
  await page.waitForSelector('.card');
  await shot('puzzle-themes');
}

if (steps.includes('lessons')) {
  await page.goto(`${base}/#/lessons`);
  await page.waitForSelector('.card');
  await shot('lessons');
  await page.goto(`${base}/#/lessons/forks`);
  await page.click('button:has-text("Next")');
  await clickMove('d5', 'c7');
  await page.waitForTimeout(900);
  await clickMove('c7', 'a8');
  await page.waitForSelector('.feedback.ok', { timeout: 5000 });
  await shot('lesson-fork');
  await page.goto(`${base}/#/lessons/queen-vs-king`);
  await page.click('button:has-text("Next")');
  await page.click('button:has-text("Next")');
  await clickMove('d1', 'd3');
  await page.waitForFunction(() => document.body.innerText.includes('Moves: 1') && !document.body.innerText.includes('thinking'), null, { timeout: 20000 });
  await page.waitForTimeout(500);
  await shot('lesson-play');
}

if (steps.includes('openings')) {
  await page.goto(`${base}/#/openings/explorer`);
  await page.waitForSelector('.tree-item');
  await page.click('.tree-item:has-text("e4")');
  await page.click('.tree-item >> nth=0');
  await shot('explorer');
  await page.goto(`${base}/#/openings`);
  await page.fill('input[type=text]', 'Smoke Italian');
  await page.click('button:has-text("Create")');
  await page.waitForSelector('text=Book moves here');
  for (const [f, t] of [['e2', 'e4'], ['e7', 'e5'], ['g1', 'f3'], ['b8', 'c6'], ['f1', 'c4']]) {
    await clickMove(f, t);
    await page.waitForTimeout(150);
  }
  await page.click('button:has-text("Save")');
  await page.click('button:has-text("Done")');
  await page.waitForSelector('.card:has-text("Smoke Italian")');
  await shot('repertoires');
  await page.click('.card:has-text("Smoke Italian") >> button:has-text("Review due")');
  try {
    await page.waitForSelector('text=What do you play here?', { timeout: 8000 });
  } catch (e) {
    await shot('rep-train-failed');
    console.log("errors so far:", errors.join(" | "));
    throw e;
  }
  await clickMove('e2', 'e4');
  await page.waitForTimeout(400);
  await shot('rep-train');
}

if (steps.includes('train')) {
  // Today's plan → warm-up set (reveal solutions to move through quickly).
  await page.goto(`${base}/#/`);
  await page.waitForSelector('.plan-item');
  await shot('train-plan');
  await page.click('.plan-item:has-text("Warm-up")');
  for (let i = 0; i < 12; i++) {
    const done = await page.locator('text=Set complete').count();
    if (done) break;
    await page.waitForSelector('button:has-text("Solution"), button:has-text("Next puzzle")', { timeout: 20000 });
    if (await page.locator('button:has-text("Solution")').count()) await page.click('button:has-text("Solution")');
    await page.waitForSelector('button:has-text("Next puzzle")', { timeout: 20000 });
    if (i === 0) await shot('train-warmup');
    await page.click('button:has-text("Next puzzle")');
    await page.waitForTimeout(300);
  }
  await page.waitForSelector('text=Set complete', { timeout: 10000 });
  await shot('train-warmup-done');

  // The plan's game: preselected bot; play two moves then resign, review it.
  await page.goto(`${base}/#/`);
  await page.waitForSelector('.plan-item');
  await page.locator('.plan-item', { has: page.locator('.plan-title', { hasText: /^Play / }) }).click();
  await page.waitForSelector('.card.selected');
  await page.selectOption('select >> nth=0', 'white');
  await page.click('button.btn.primary:has-text("Play ")');
  await page.waitForSelector('cg-board');
  await clickMove('f2', 'f3');
  await page.waitForFunction(() => document.querySelectorAll('.move-list .mv').length >= 2, null, { timeout: 20000 });
  await clickMove('g2', 'g4');
  await page.waitForFunction(() => document.querySelectorAll('.move-list .mv').length >= 4, null, { timeout: 20000 });
  await page.click('button:has-text("Resign")');
  await page.click('button:has-text("Review this game")');
  await page.waitForSelector('text=mistake trainer', { timeout: 90000 });
  await shot('train-review');

  await page.goto(`${base}/#/`);
  await page.waitForSelector('.plan-item');
  await page.waitForTimeout(500);
  await shot('train-plan-after');
  await page.goto(`${base}/#/train/mistakes`);
  await page.waitForSelector('text=Mistake trainer', { timeout: 20000 });
  await page.waitForTimeout(800);
  await shot('train-mistakes');
}

for (const s of steps.filter((x) => !['home', 'analysis', 'review', 'play', 'puzzles', 'lessons', 'openings', 'train'].includes(x))) {
  await page.goto(`${base}/#/${s}`);
  await page.waitForTimeout(1500);
  await shot(s.replace(/\//g, '_'));
}

console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'no page errors');
await browser.close();

