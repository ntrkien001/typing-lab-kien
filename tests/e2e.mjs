/* Optional real-browser tests for Typing Lab 2.4 (Chromium + simulated IME).
 *
 *   npm i -D playwright && npx playwright install chromium
 *   node tests/e2e.mjs
 *
 * Starts a tiny static server for the repo root, drives the page in Chromium and
 * simulates a 2-set Korean IME via CDP (compose jamo, finalise the last syllable
 * with Space/Enter). This exercises the bug class that linkedom cannot reach.
 *
 * NOTE: this simulates IME event sequences; it is still not a substitute for a
 * hand test on a real Korean keyboard (Windows/macOS) and on a phone. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  console.error('Playwright not installed. Run: npm i -D playwright && npx playwright install chromium');
  process.exit(2);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(root, p);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('404'); }
  res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
  res.end(fs.readFileSync(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = 'http://127.0.0.1:' + server.address().port;

const results = [];
const ok = (n, cond, d = '') => results.push({ n, ok: !!cond, d });
const browser = await chromium.launch();

async function fresh() {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(base + '/index.html');
  await page.waitForFunction(() => window.TL && window.TL.S);
  const cdp = await ctx.newCDPSession(page);
  return { ctx, page, cdp };
}
const compose = (cdp, t) => cdp.send('Input.imeSetComposition', { text: t, selectionStart: t.length, selectionEnd: t.length });
const commit = (cdp, t) => cdp.send('Input.insertText', { text: t });
async function imeSyllables(cdp, steps) {
  for (let i = 0; i < steps.length; i++) {
    for (const p of steps[i]) await compose(cdp, p);
    if (i < steps.length - 1) await commit(cdp, steps[i].at(-1));
  }
}
const GANADA = [['ㄱ', '가'], ['ㄴ', '나'], ['ㄷ', '다']];
const state = (page) => page.evaluate(() => ({ index: TL.S.index, finished: TL.S.finished, errors: TL.S.errors, acc: TL.calc().accuracy, val: TL.$('typing').value }));

{
  const { ctx, page, cdp } = await fresh();
  await page.evaluate(() => TL.setLesson(['가나다', '라마']));
  await page.focus('#typing');
  await imeSyllables(cdp, GANADA);
  await commit(cdp, '다');
  await commit(cdp, ' ');
  await page.waitForTimeout(80);
  const s = await state(page);
  ok('Space finalise: advance, no error, clean next box', s.index === 1 && s.errors === 0 && s.acc === 100 && s.val === '', JSON.stringify(s));
  await ctx.close();
}
{
  const { ctx, page, cdp } = await fresh();
  await page.evaluate(() => TL.setLesson(['가나다', '라마']));
  await page.focus('#typing');
  await imeSyllables(cdp, GANADA);
  await commit(cdp, '다');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(80);
  const s = await state(page);
  ok('Enter finalise: advance, no error', s.index === 1 && s.errors === 0, JSON.stringify(s));
  await ctx.close();
}
{
  const { ctx, page, cdp } = await fresh();
  const lines = ['가나다', '라마바', '사아자'];
  await page.evaluate((l) => TL.setLesson(l), lines);
  await page.focus('#typing');
  for (let i = 0; i < lines.length; i++) {
    for (const ch of lines[i]) await commit(cdp, ch);
    if (i < lines.length - 1) await commit(cdp, ' ');
  }
  await page.waitForTimeout(80);
  const s = await state(page);
  ok('Perfect run with Space between sentences = 100%', s.finished && s.acc === 100 && s.errors === 0, JSON.stringify(s));
  await ctx.close();
}
{
  const { ctx, page } = await fresh();
  const nextKey = await page.evaluate(() => { TL.setLesson(['값']); return document.querySelector('.kbKey.next')?.dataset.key; });
  ok('Keyboard highlights first key (값 -> r)', nextKey === 'r', String(nextKey));
  await ctx.close();
}

for (const r of results) console.log((r.ok ? 'PASS ' : 'FAIL ') + r.n + (!r.ok && r.d ? ' — ' + r.d : ''));
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} passed`);
await browser.close();
server.close();
if (results.some((r) => !r.ok)) process.exitCode = 1;
