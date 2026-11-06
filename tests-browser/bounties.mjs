import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

// This fresh earned bounty journey is not a full-game or balance proof.
// All progress comes from UI clicks and key presses. Evaluation only observes game state/layout;
// the one controlled input is Math.random, to avoid incidental patrols.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifacts = path.join(root, 'browser-artifacts', 'bounties');
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
    const id = `${width}-bounty`;
    const context = await browser.newContext({ viewport: { width, height: 800 } });
    const errors = [];
    try {
      await context.tracing.start({ screenshots: true, snapshots: true });
      const page = await context.newPage();
      page.setDefaultTimeout(10_000);
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => { Math.random = () => 0.5; });
      const control = (action, arg) => page.locator(`#app [data-action="${action}"]${arg === undefined ? '' : `[data-arg="${arg}"]`}`).first();
      const click = (action, arg) => control(action, arg).click();
      const state = () => page.evaluate(() => structuredClone(window.game.state));
      const quick = () => page.evaluate(() => localStorage.getItem('stormhaven-save'));
      const fit = async (label, selector) => {
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width, `${id} ${label}: document fits`);
        const bounds = await page.locator(selector).evaluateAll(nodes => nodes.map(node => {
          const r = node.getBoundingClientRect();
          return r.height >= 44 && r.left >= 0 && r.right <= innerWidth + 1 && node.scrollWidth <= node.clientWidth + 1;
        }));
        assert.ok(bounds.length > 0 && bounds.every(Boolean), `${id} ${label}: controls and labels fit`);
        await page.screenshot({ path: path.join(artifacts, `${id}-${label}.png`), fullPage: true });
      };
      const walk = async (tx, ty) => {
        // Catalog and state are observed only. Every selected step is a native click.
        const route = await page.evaluate(async ({ tx, ty }) => {
          const { ZONES, isWalkable } = await import('/src/map/index.js');
          const map = window.game.state.map, zone = ZONES[map.zoneId];
          const queue = [[map.x, map.y, []]], seen = new Set([`${map.x},${map.y}`]);
          while (queue.length) {
            const [x, y, steps] = queue.shift();
            if (x === tx && y === ty) return steps;
            for (const [dx, dy, action] of [[1, 0, 'moveEast'], [-1, 0, 'moveWest'], [0, 1, 'moveSouth'], [0, -1, 'moveNorth']]) {
              const nx = x + dx, ny = y + dy, key = `${nx},${ny}`;
              if (seen.has(key) || !isWalkable(zone, map, nx, ny)) continue;
              if (zone.npcs?.some(n => n.x === nx && n.y === ny)) continue;
              if (nx !== tx || ny !== ty) {
                if (zone.exits?.some(e => e.x === nx && e.y === ny)) continue;
                if (zone.encounters?.some(e => e.x === nx && e.y === ny && !map.clearedEncounters[e.encounterId])) continue;
              }
              seen.add(key); queue.push([nx, ny, [...steps, action]]);
            }
          }
          return null;
        }, { tx, ty });
        assert.ok(route, `${id}: walkable route to ${tx},${ty}`);
        for (const action of route) {
          assert.equal((await state()).scene, 'explore', 'walking must not conceal a battle');
          await click(action);
        }
      };
      const exit = async destination => {
        const tile = await page.evaluate(async destination => {
          const { ZONES } = await import('/src/map/index.js');
          return ZONES[window.game.state.map.zoneId].exits.find(e => e.toZone === destination);
        }, destination);
        assert.ok(tile, `physical exit to ${destination}`);
        await walk(tile.x, tile.y);
        const s = await state();
        assert.equal(s.scene, 'explore');
        assert.equal(s.map.zoneId, destination); assert.equal(s.location, destination);
      };
      const fight = async encounterId => {
        if (encounterId) {
          const tile = await page.evaluate(async encounterId => {
            const { ZONES } = await import('/src/map/index.js');
            return ZONES[window.game.state.map.zoneId].encounters.find(e => e.encounterId === encounterId);
          }, encounterId);
          assert.ok(tile); await walk(tile.x, tile.y);
        } else await click('mapPatrol');
        const before = await state();
        assert.equal(before.scene, 'combat'); assert.equal(before.combat.encounterId, encounterId);
        const enemy = before.combat.enemy;
        for (let turn = 0; !(await state()).combat.over && turn < 100; turn++) await click('attack');
        const won = await state();
        assert.equal(won.combat.over, 'victory', `earned victory: ${encounterId}`);
        assert.equal(won.gold, before.gold + enemy.gold);
        assert.equal(won.combat.rewards.gold, enemy.gold); assert.equal(won.combat.rewards.xp, enemy.xp);
        won.party.forEach((m, i) => assert.equal(m.xp, before.party[i].xp + enemy.xp));
        assert.deepEqual(won.bestiary, { ...before.bestiary, [enemy.id]: (before.bestiary?.[enemy.id] || 0) + 1 });
        const inventory = structuredClone(before.inventory);
        for (const drop of won.combat.rewards.items) {
          const stack = inventory.find(item => item.id === drop.id);
          if (stack) stack.qty += drop.qty; else inventory.push({ ...drop });
        }
        assert.deepEqual(won.inventory, inventory, 'real victory loot is added exactly once');
        await click('finish');
        const after = await state();
        assert.equal(after.scene, 'explore'); assert.equal(after.combat, null);
        assert.equal(after.map.activeEncounterId, null); if (encounterId) assert.equal(after.map.clearedEncounters[encounterId], true);
        for (const key of ['gold', 'inventory', 'bestiary']) assert.deepEqual(after[key], won[key], `Finish preserves ${key}`);
        assert.deepEqual(after.party.map(m => m.xp), won.party.map(m => m.xp));
      };
      const checkpoint = async (stage, label) => {
        const before = await state();
        assert.equal(before.scene, 'explore'); assert.equal(before.story.stage, stage);
        await click('save');
        const raw = await quick();
        // Save writes before adding its live map-log message. Compare to pre-click state.
        assert.deepEqual(JSON.parse(raw), before, 'the full earned checkpoint is serialized');
        await page.reload(); await click('continue');
        assert.deepEqual(await state(), before, 'Continue restores the entire earned exploration checkpoint');
        assert.equal(await quick(), raw, 'Continue does not rewrite the save');
        assert.equal(await page.locator('html').getAttribute('data-text-size'), '130');
        await fit(label, '#app [data-action="save"]');
      };
      const journal = async (progress, label) => {
        const before = await state(), raw = await quick();
        await click(before.scene === 'town' ? 'questJournal' : 'openQuests');
        const opened = await state();
        assert.deepEqual(opened, { ...before, scene: 'quests' });
        for (const filter of ['active', 'complete', 'all']) {
          await click('filterQuests', filter);
          const line = page.locator('.quest-bounty-summary');
          if (progress === null) assert.equal(await line.count(), 0);
          else assert.equal(await line.textContent(), progress >= 4
            ? 'Bounty contract: “Ridge Road Rat Cull” complete — claim it at the Greyhaven bounty board.'
            : `Bounty contract: “Ridge Road Rat Cull” — ${progress}/4 defeated.`);
          assert.deepEqual(await state(), opened, 'Journal and filters preserve whole state');
          assert.equal(await quick(), raw, 'Journal never writes quick save');
          if (progress !== null) assert.equal(await line.evaluate(n => n.scrollWidth <= n.clientWidth + 1), true);
        }
        await fit(`journal-${label}`, '#app button');
        await click('leave');
        assert.deepEqual(await state(), before, 'Journal Back preserves whole state');
        assert.equal(await quick(), raw);
      };
      const talk = async (npc, reward, stage) => {
        const before = await state(); await click('storyTalk', npc); const after = await state();
        assert.equal(after.gold, before.gold + reward, `${npc}: exact turn-in payment`);
        assert.equal(after.story.stage, stage);
      };
      try {
        await page.goto(base); await click('newGame');
        await page.locator('[aria-controls="display-settings"]').click();
        await page.locator('[data-display-scale]').selectOption('130');
        await page.locator('[data-display-done]').click();
        await journal(null, 'fresh');
        const freshTown = await state();
        await click('bounties');
        assert.equal(await page.locator('.bounty--locked').count(), 9);
        assert.equal(await page.locator('[data-action="acceptBounty"]').count(), 0);
        assert.equal(await page.locator('.bounty__brief').count(), 0);
        await fit('locked', '#app button');
        await click('closeBounties'); assert.deepEqual(await state(), freshTown);
        await click('explore'); await talk('mara', 0, 'road');
        await exit('ridge_road'); await fight('ridge_patrol');
        await exit('greyhaven'); await click('toTownScene'); await click('muster');
        await click('recruit', 'tamsin'); await click('leave'); await click('rest');
        await click('explore'); await exit('ridge_road'); await fight(null);
        assert.equal((await state()).bestiary.storm_rat, 1);
        await exit('greyhaven'); await click('toTownScene'); await click('bounties');
        const unlocked = await state();
        await fit('unlocked', '#app button');
        await click('acceptBounty', 'ridge_rats');
        const active = await state();
        assert.deepEqual(active, { ...unlocked, bounties: { active: 'ridge_rats', progress: 0, completed: {} } });
        await fit('active', '#app button');
        await click('closeBounties'); await journal(0, 'accepted'); await click('rest'); await click('explore');
        await exit('ridge_road');
        for (let n = 1; n <= 5; n++) {
          await fight(null);
          assert.equal((await state()).bounties.progress, Math.min(4, n));
          assert.deepEqual((await state()).bounties.completed, {});
          await journal(Math.min(4, n), `victory-${n}`);
        }
        await checkpoint((await state()).story.stage, 'completed-unclaimed');
        await journal(4, 'reloaded-ready');
        await exit('greyhaven'); await click('toTownScene'); await click('bounties');
        await fit('ready', '#app button');
        const beforeClaim = await state(); await click('claimBounty'); const claimed = await state();
        const expected = structuredClone(beforeClaim);
        expected.gold += 30;
        const scrap = expected.inventory.find(i => i.id === 'scrap_metal');
        if (scrap) scrap.qty++; else expected.inventory.push({ id: 'scrap_metal', qty: 1 });
        expected.bounties = { active: null, progress: 0, completed: { ridge_rats: 1 } };
        assert.deepEqual(claimed, expected, 'only advertised reward and contract state change');
        assert.equal(await page.locator('[data-action="claimBounty"]').count(), 0);
        await fit('claimed', '#app button');
        await click('acceptBounty', 'ridge_rats');
        assert.deepEqual((await state()).bounties, { active: 'ridge_rats', progress: 0, completed: { ridge_rats: 1 } });
        await click('abandonBounty'); assert.deepEqual(await state(), claimed, 'abandon retains rewards and resets only fresh contract');
        await click('closeBounties'); await journal(null, 'claimed'); await click('explore');
        await checkpoint((await state()).story.stage, 'claimed-home');
        assert.deepEqual(errors, []);
        console.log(`PASS ${id}: fresh locked board, earned unlock, six patrol wins, progress capped, exact explicit reward, reaccept/abandon, whole save/reload, Journal all filters whole-state/quick-save invariance and 130% fit; errors []`);
      } catch (error) {
        await page.screenshot({ path: path.join(artifacts, `${id}-failure.png`), fullPage: true }).catch(() => {});
        console.error(`FAIL ${id}; browser errors: ${JSON.stringify(errors)}`);
        throw error;
      }
    } finally {
      try { await context.tracing.stop({ path: path.join(artifacts, `${id}-trace.zip`) }); }
      finally { await context.close(); }
    }
  }
} finally {
  try { if (browser) await browser.close(); }
  finally { await new Promise(resolve => server.close(resolve)); }
}
