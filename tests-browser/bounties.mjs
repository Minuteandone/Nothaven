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
        if ((await state()).scene === 'rewardChoice') {
          assert.match(await page.locator('#app').innerText(), /Victory spoils/);
          await click('skip');
        }
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
      const serviceRank = async (expected, label) => {
        const before = await state(), raw = await quick();
        await click('feats');
        const opened = await state();
        assert.deepEqual(opened, { ...before, scene: 'feats' });
        for (const filter of ['all', 'earned', 'pending']) {
          await click('filterFeats', filter);
          const row = page.locator('.service-record__list div').filter({
            has: page.locator('dt', { hasText: /^Board rank$/ }),
          });
          assert.equal(await row.locator('dd').textContent(), expected);
          const masteryRow = page.locator('.service-record__list div').filter({
            has: page.locator('dt', { hasText: /^Contracts mastered$/ }),
          });
          const mastered = ['claim-3', 'claim-4'].includes(label) ? 1 : 0;
          assert.equal(await masteryRow.locator('dd').textContent(), `${mastered} of 18`);
          assert.deepEqual(await state(), opened);
          assert.equal(await quick(), raw);
          await fit(`record-${label}-${filter}`, '#app button');
        }
        await click('closeFeats');
        assert.deepEqual(await state(), before);
        assert.equal(await quick(), raw);
      };
      const checkSort = async (label, boardTitles, claimTitles, locked) => {
        const before = await state(), raw = await quick();
        const region = await page.locator('[data-action="filterBounties"][aria-pressed="true"]').getAttribute('data-arg').catch(() => null);
        assert.deepEqual(await page.locator('[data-action="sortBounties"]').evaluateAll(ns => ns.map(n => n.dataset.arg)), ['board', 'pay', 'claims', 'easiest']);
        // Rat (4 × 12 HP) is an easier hunt than Bandit (3 × 20 HP), so easiest matches board order here.
        // Only Rat and Bandit are genuinely discovered: Bandit's pay exceeds Rat's,
        // while unclaimed Bandit precedes Rat by fewest claims after a real payout.
        const payTitles = [...boardTitles].reverse();
        for (const [sort, titles] of [['pay', payTitles], ['claims', claimTitles], ['easiest', boardTitles], ['board', boardTitles]]) {
          await click('sortBounties', sort);
          assert.deepEqual(await page.locator('.bounty__title').allTextContents(), [...titles, ...Array(locked).fill('Unposted contract')]);
          assert.equal(await page.locator('.bounty--locked').count(), locked);
          assert.equal(await page.locator('[data-action="sortBounties"][aria-pressed="true"]').count(), 1);
          assert.equal(await control('sortBounties', sort).getAttribute('aria-pressed'), 'true');
          assert.equal(await page.locator('[data-action="filterBounties"][aria-pressed="true"]').getAttribute('data-arg').catch(() => null), region);
          assert.deepEqual(await state(), before, 'sorting is free and preserves the entire earned state');
          assert.equal(await quick(), raw, 'sorting never rewrites quick save');
          await fit(`sort-${label}-${sort}`, '#app [data-action="sortBounties"]');
        }
      };
      const exchangeView = async (label, expectedText, available, earned, spent, enabledIds, dressings) => {
        const before = await state(), raw = await quick();
        for (const scale of ['115', '130']) {
          await page.locator('[aria-controls="display-settings"]').click();
          await page.locator('[data-display-scale]').selectOption(scale);
          await page.locator('[data-display-done]').click();
          const line = page.locator('.exchange__afford');
          assert.equal(await line.textContent(), expectedText);
          assert.equal(await line.getAttribute('role'), null, 'static affordability is not a live status');
          assert.equal(await page.locator('.exchange__marks').textContent(),
            `Board Marks: ${available} available (${earned} earned, ${spent} spent).`);
          assert.deepEqual(await page.locator('[data-action="exchangeMarks"]:enabled').evaluateAll(ns => ns.map(n => n.dataset.arg)), enabledIds);
          const dressingRow = page.locator('.exchange__offer').filter({ has: page.locator('[data-action="exchangeMarks"][data-arg="dressings"]') });
          assert.equal(await dressingRow.locator('.exchange__owned').textContent(), `In pack: ${dressings}.`);
          await line.scrollIntoViewIfNeeded(); await page.mouse.move(0, 0); await page.waitForTimeout(250);
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width);
          assert.equal(await line.evaluate(n => {
            const box = n.getBoundingClientRect(), range = document.createRange();
            range.selectNodeContents(n);
            return box.left >= 0 && box.right <= innerWidth + 1 && [...range.getClientRects()].every(g =>
              g.left >= box.left - 1 && g.right <= box.right + 1 && g.top >= box.top - 1 && g.bottom <= box.bottom + 1);
          }), true, `${id} ${label} ${scale}: affordability glyphs fit`);
          const bounds = await page.locator('[data-action="exchangeMarks"]').evaluateAll(ns => ns.map(n => {
            const r = n.getBoundingClientRect();
            return r.height >= 44 && r.left >= 0 && r.right <= innerWidth + 1 && n.scrollWidth <= n.clientWidth + 1;
          }));
          assert.equal(bounds.length, 7); assert.ok(bounds.every(Boolean), 'all seven Exchange controls fit and meet 44px');
          assert.deepEqual(await state(), before, 'Exchange viewing and Display preferences preserve the whole journey');
          assert.equal(await quick(), raw, 'Exchange viewing never rewrites quick save');
          await page.screenshot({ path: path.join(artifacts, `${id}-exchange-${label}-${scale}.png`), fullPage: true });
        }
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
        await journal(null, 'fresh'); await serviceRank('Notice Runner', 'fresh');
        const freshTown = await state();
        await click('bounties');
        await exchangeView('fresh', 'You can afford 0 of 7 offers. Cheapest out of reach: Field Dressing at 2 marks (2 more needed).', 0, 0, 0, [], 0);
        assert.equal(await page.locator('.bounty--locked').count(), 18);
        assert.equal(await control('filterBounties').count(), 0);
        assert.equal(await page.locator('[data-action="acceptBounty"]').count(), 0);
        assert.equal(await page.locator('.bounty__brief').count(), 0);
        assert.equal(await page.locator('.bounties__rank').textContent(), 'Board rank: Notice Runner (+0% gold). 3 more claims to Contract Hand (+10% gold).');
        await fit('locked', '#app button');
        assert.equal(await control('sortBounties', 'board').getAttribute('aria-pressed'), 'true');
        await checkSort('locked', [], [], 18);
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
        assert.deepEqual(active, { ...unlocked, bounties: { active: 'ridge_rats', progress: 0, completed: {}, spent: 0 } });
        await fit('active', '#app button');
        const rawFilter = await quick();
        assert.deepEqual(await page.locator('[data-action="filterBounties"]').evaluateAll(ns => ns.map(n => n.dataset.arg)), ['', 'Ridge Road', 'Observatory Ruins', 'Highwatch Pass']);
        for (const [region, titles] of [
          ['Highwatch Pass', ['Ridge Road Rat Cull', 'Bandit Toll Road']],
          ['Observatory Ruins', ['Ridge Road Rat Cull']],
          ['Ridge Road', ['Ridge Road Rat Cull', 'Bandit Toll Road']],
        ]) {
          await click('filterBounties', region);
          assert.deepEqual(await page.locator('.bounty__title').allTextContents(), titles);
          assert.equal(await page.locator('.bounty--active').count(), 1);
          const note = await page.locator('.bounties__filter-note').textContent();
          if (region === 'Highwatch Pass') {
            assert.equal(note, '1 contract roams Highwatch Pass. Your active contract, Ridge Road Rat Cull, stays listed too.');
          } else {
            assert.equal(note, `${titles.length} ${titles.length === 1 ? 'contract roams' : 'contracts roam'} ${region}.`);
          }
          assert.equal(await control('filterBounties', region).getAttribute('aria-pressed'), 'true');
          assert.equal(await page.locator('.bounty--locked').count(), 0);
          assert.equal(await page.locator('[data-action="filterBounties"][aria-pressed="true"]').count(), 1);
          assert.deepEqual(await state(), active);
          assert.equal(await quick(), rawFilter);
          await fit(`filter-${region.replaceAll(' ', '-')}`, '#app button');
          await checkSort(region.replaceAll(' ', '-'), titles, titles, 0);
        }
        await click('closeBounties'); await click('bounties');
        assert.equal(await control('filterBounties', '').getAttribute('aria-pressed'), 'true');
        assert.equal(await page.locator('.bounty__title').count(), 18);
        assert.equal(await page.locator('.bounty--locked').count(), 16);
        assert.equal(await page.locator('.bounties__filter-note').count(), 0);
        assert.equal(await page.locator('[data-action="filterBounties"][aria-pressed="true"]').count(), 1);
        assert.deepEqual(await state(), active);
        assert.equal(await quick(), rawFilter);

        await checkSort('all-active', ['Ridge Road Rat Cull', 'Bandit Toll Road'], ['Ridge Road Rat Cull', 'Bandit Toll Road'], 16);
        await click('sortBounties', 'pay');
        await click('closeBounties'); await click('bounties');
        assert.equal(await control('sortBounties', 'board').getAttribute('aria-pressed'), 'true');
        assert.equal(await control('filterBounties', '').getAttribute('aria-pressed'), 'true');
        assert.deepEqual(await state(), active);
        assert.equal(await quick(), rawFilter);

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
        expected.bounties = { active: null, progress: 0, completed: { ridge_rats: 1 }, spent: 0 };
        assert.deepEqual(claimed, expected, 'only advertised reward and contract state change');
        assert.equal(await page.locator('[data-action="claimBounty"]').count(), 0);
        await fit('claimed', '#app button');
        await click('acceptBounty', 'ridge_rats');
        assert.deepEqual((await state()).bounties, { active: 'ridge_rats', progress: 0, completed: { ridge_rats: 1 }, spent: 0 });
        await click('abandonBounty'); assert.deepEqual(await state(), claimed, 'abandon retains rewards and resets only fresh contract');
        await click('closeBounties'); await journal(null, 'claimed'); await click('explore');
        await checkpoint((await state()).story.stage, 'claimed-home');
        // Repeat actual patrol contracts: claims two and three pay 30; claim four pays 33.
        for (let count = 2; count <= 4; count++) {
          await click('toTownScene'); await click('bounties');
          await click('acceptBounty', 'ridge_rats');
          assert.deepEqual((await state()).bounties, { active: 'ridge_rats', progress: 0, completed: { ridge_rats: count - 1 }, spent: 0 });
          await click('closeBounties'); await click('rest'); await click('explore');
          await exit('ridge_road');
          for (let n = 1; n <= 4; n++) {
            await fight(null); assert.equal((await state()).bounties.progress, n);
          }
          await exit('greyhaven'); await click('toTownScene'); await click('bounties');
          const before = await state(), pay = count === 4 ? 33 : 30;
          assert.match(await page.locator('.bounty').filter({has:page.locator('[data-action="claimBounty"]')}).textContent(),new RegExp(`Reward: ${pay} gold`));
          await click('claimBounty');
          const expected = structuredClone(before); expected.gold += pay;
          // Claim four is the first after mastery (three claims), so it pays one extra Scrap Metal.
          expected.inventory.find(i => i.id === 'scrap_metal').qty += count === 4 ? 2 : 1;
          expected.bounties = { active: null, progress: 0, completed: { ridge_rats: count }, spent: 0 };
          assert.equal((await page.locator('#app').textContent()).includes('Mastery bonus: +1 Scrap Metal.'), count === 4);
          assert.deepEqual(await state(), expected);
          assert.equal((await page.locator('#app').textContent()).includes('Board rank raised to Contract Hand.'),count === 3);
          assert.match(await page.locator('.bounties__rank').textContent(),count >= 3 ? /Contract Hand \(\+10% gold\)/:/Notice Runner \(\+0% gold\)/);
          assert.equal(await control('claimBounty').count(),0);
          await fit(`claim-${count}`, '#app button');
          await checkSort(`paid-${count}`, ['Ridge Road Rat Cull', 'Bandit Toll Road'], ['Bandit Toll Road', 'Ridge Road Rat Cull'], 16);
          await click('closeBounties'); await serviceRank(count >= 3 ? 'Contract Hand':'Notice Runner',`claim-${count}`); await click('explore');
          await checkpoint((await state()).story.stage,`claim-${count}-saved`);
          await click('toTownScene'); await click('bounties');
          assert.match(await page.locator('.bounties__rank').textContent(),count >= 3 ? /Contract Hand/:/Notice Runner/);
          await click('closeBounties'); await click('explore');
        }
        // These four marks came from the original four complete patrol contracts above.
        // This is ordinary-price coverage, not an earned Warden-discount journey.
        assert.equal((await state()).scene, 'explore');
        await click('toTownScene'); await click('bounties');
        await exchangeView('earned', 'You can afford 3 of 7 offers. Cheapest out of reach: Storm Glass at 5 marks (1 more needed).', 4, 4, 0, ['dressings', 'flask', 'broth'], 0);
        const beforeExchange = await state(), rawExchange = await quick();
        await click('exchangeMarks', 'dressings');
        const paidExchange = structuredClone(beforeExchange);
        const dressing = paidExchange.inventory.find(i => i.id === 'field_dressing');
        if (dressing) dressing.qty += 2; else paidExchange.inventory.push({ id: 'field_dressing', qty: 2 });
        paidExchange.bounties.spent = 2;
        assert.deepEqual(await state(), paidExchange, 'Exchange changes only two spent marks and two Field Dressings');
        assert.equal(await quick(), rawExchange, 'a purchase does not auto-save');
        const paidHint = 'You can afford 1 of 7 offers. Cheapest out of reach: Highland Flask at 3 marks (1 more needed).';
        await exchangeView('purchased', paidHint, 2, 4, 2, ['dressings'], 2);
        await click('closeBounties'); await click('explore');
        await checkpoint((await state()).story.stage, 'exchange-saved');
        await click('toTownScene'); await click('bounties');
        assert.deepEqual((await state()).bounties, paidExchange.bounties);
        assert.deepEqual((await state()).inventory, paidExchange.inventory);
        await exchangeView('reloaded', paidHint, 2, 4, 2, ['dressings'], 2);
        assert.deepEqual(errors, []);
        console.log(`PASS ${id}: earned native sorting/locked-last/non-tied claims/reset and mastery Record 0→1; earned regional filters/active-outside count/reset; Service Record rank across all filters/fresh and claims 2–4; four earned claims, promotion on third, fourth pays 33 plus a mastery Scrap Metal, whole exact payment states, rank survives whole save/reload, original bounty/Journal assertions retained; Exchange 4 earned marks, 2 spent, +2 Dressings and whole Save/Reload, literal hints and 115/130% geometry; errors []`);
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
