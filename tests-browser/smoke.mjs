import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

// This short new-game smoke test is not a full campaign or balance proof.
// All progress comes from UI clicks. Evaluation only observes game state/layout;
// the one controlled input is Math.random, to avoid incidental patrols.
const root = fileURLToPath(new URL('../', import.meta.url));
const artifacts = path.join(root, 'browser-artifacts');
await mkdir(artifacts, { recursive: true });
const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const relative = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1));
    const file = path.resolve(root, relative);
    const allowed = ['index.html', 'style.css'].includes(relative)
      || (relative.startsWith('src/') && file.startsWith(path.join(root, 'src') + path.sep));
    if (!allowed) { res.writeHead(404); res.end(); return; }
    const data = await readFile(file);
    const type = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' }[path.extname(file)] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type }); res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ headless: true });
  for (const width of [320, 375, 768]) {
    const context = await browser.newContext({ viewport: { width, height: 800 } });
    await context.tracing.start({ screenshots: true, snapshots: true });
    const page = await context.newPage();
    page.setDefaultTimeout(10_000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => { Math.random = () => 0.5; });
    const click = (action, arg) => page.locator(`[data-action="${action}"]${arg === undefined ? '' : `[data-arg="${arg}"]`}`).first().click();
    const state = () => page.evaluate(() => structuredClone(window.game.state));
    const progress = async () => { const s = await state(); delete s.scene; return s; };
    const fit = async label => {
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width, `${label}: horizontal overflow at ${width}`);
      await page.screenshot({ path: path.join(artifacts, `${width}-${label}.png`), fullPage: true });
    };
    const readOnlyVisit = async (action, title) => {
      const before = await progress();
      // Bag rendering initializes missing empty slots; this changes only our
      // expected snapshot, never live game state. All other fields stay strict.
      if (action === 'bag' && !before.party[0].equipment) {
        before.party[0].equipment = { weapon: null, armor: null, trinket: null };
      }
      await click(action);
      assert.match(await page.locator('h1, h2').first().innerText(), title);
      await fit(action);
      await click('leave');
      assert.equal((await state()).scene, 'town');
      assert.deepEqual(await progress(), before, `${action}: opening and closing changed progress`);
    };
    try {
      await page.goto(base);
      assert.equal(await page.locator('[data-action="continue"]').isDisabled(), true);
      await fit('title');
      await click('guide'); await fit('guide'); await click('closeGuide');
      await click('newGame'); await fit('town');
      const initial = await progress();
      await click('questJournal');
      for (const filter of ['active', 'complete', 'all']) {
        await click('filterQuests', filter);
        assert.equal(await page.locator('[aria-pressed="true"]').count(), 1);
        assert.equal(await page.locator(`[data-action="filterQuests"][data-arg="${filter}"]`).getAttribute('aria-pressed'), 'true');
        if (filter === 'complete') assert.match(await page.locator('main').innerText(), /No completed objectives yet\./);
        else assert.deepEqual(await page.locator('.quest-entry h2').allTextContents(), ['A Light in the Storm']);
        await fit(`journal-${filter}`);
        assert.deepEqual(await progress(), initial);
      }
      await click('leave');
      await readOnlyVisit('bestiary', /Field Journal/);
      await readOnlyVisit('muster', /Muster/i);
      await readOnlyVisit('bag', /Bag/i);
      await click('shop');
      await click('buy5', 'rations');
      assert.equal((await state()).gold, 2);
      assert.equal((await state()).inventory.find(item => item.id === 'rations').qty, 3);
      const purchased = await progress();
      for (const mode of ['buy', 'sell', 'craft']) {
        await click('setMode', mode); await fit(`shop-${mode}`);
        assert.deepEqual(await progress(), purchased);
      }
      await click('leave'); await click('save');
      await page.reload(); await click('continue');
      assert.equal((await state()).gold, 2);
      assert.equal((await state()).inventory.find(item => item.id === 'rations').qty, 3);
      await click('storyTalk', 'mara');
      await click('explore');
      const inField = await progress();
      await click('openQuests'); await click('filterQuests', 'all'); await click('leave');
      assert.equal((await state()).scene, 'explore');
      assert.deepEqual(await progress(), inField);
      await fit('explore');
      // Greyhaven's east exit leads to the ridge; the fixed patrol is four steps east.
      for (let step = 0; step < 6; step++) await click('moveEast');
      assert.equal((await state()).map.zoneId, 'ridge_road');
      for (let step = 0; step < 4; step++) await click('moveEast');
      assert.equal((await state()).scene, 'combat');
      await fit('combat');
      for (let turn = 0; turn < 40 && !(await state()).combat.over; turn++) await click('attack');
      assert.equal((await state()).combat.over, 'victory');
      assert.match(await page.locator('.battle-summary').innerText(), /\d+ rounds? · \d+ damage dealt · \d+ damage taken/);
      await fit('victory'); await click('finish');
      assert.equal((await state()).map.clearedEncounters.ridge_patrol, true);
      await click('save');
      const saved = await state();
      await page.reload(); await click('continue');
      assert.equal((await state()).scene, 'explore');
      assert.deepEqual((await state()).story, saved.story);
      assert.deepEqual((await state()).party, saved.party);
      assert.equal((await state()).gold, saved.gold);
      assert.equal((await state()).map.clearedEncounters.ridge_patrol, true);
      await click('openJournal');
      assert.match(await page.locator('main').innerText(), /Ridge Bandit/);
      await fit('earned-bestiary'); await click('leave');
      assert.equal((await state()).scene, 'explore');
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}px: navigation, filters, purchase, save/reload, earned ridge victory; browser errors []`);
    } catch (error) {
      await page.screenshot({ path: path.join(artifacts, `${width}-failure.png`), fullPage: true }).catch(() => {});
      console.error(`FAIL ${width}px; browser errors: ${JSON.stringify(errors)}`);
      throw error;
    } finally {
      await context.tracing.stop({ path: path.join(artifacts, `${width}-trace.zip`) });
      await context.close();
    }
  }
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
