import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

// This short new-game smoke test is not a full campaign or balance proof.
// All progress comes from UI clicks and key presses. Evaluation only observes game state/layout;
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
    const setShortcuts = async enabled => {
      const before = await state();
      await page.locator('[aria-controls="display-settings"]').click();
      await page.locator('[data-display-shortcuts]').setChecked(enabled);
      await page.locator('[data-display-done]').click();
      assert.equal(await page.locator('html').getAttribute('data-character-shortcuts'), enabled ? 'on' : 'off');
      assert.deepEqual(await state(), before, 'device preference must not change journey state');
    };
    const fit = async label => {
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width, `${label}: horizontal overflow at ${width}`);
      await page.screenshot({ path: path.join(artifacts, `${width}-${label}.png`), fullPage: true });
    };
    const checkBagSearch = async () => {
      const town = await state();
      const quick = await page.evaluate(() => localStorage.getItem('stormhaven-save'));
      await click('bag');
      const bag = await state();
      const inventoryNames = page.locator('.bag-group:not([aria-label="Equipped"]) .bag-list .bag-name');
      const recipes = page.locator('.craft-table tr');
      const allRecipes = await recipes.count();
      const allNames = await inventoryNames.allTextContents();
      assert.deepEqual(allNames, ['Trail Rations ×3'], 'search uses genuinely purchased supplies');
      assert.ok(allRecipes > 0, 'recipe catalogue is present');
      const unchanged = async () => {
        assert.deepEqual(await state(), bag, 'Bag search/sort must preserve the whole journey state');
        assert.equal(await page.evaluate(() => localStorage.getItem('stormhaven-save')), quick);
      };
      const search = async query => {
        await page.locator('#bag-search-input').fill(query);
        await click('bagSearchApply');
        await unchanged();
      };
      const searchFit = async label => {
        await fit(label);
        const controls = await page.locator('.bag-search-row input,.bag-search-row button').evaluateAll(nodes => nodes.map(node => {
          const r = node.getBoundingClientRect();
          return r.left >= 0 && r.right <= innerWidth + 1 && r.height >= 44
            && (node.tagName === 'INPUT' || node.scrollWidth <= node.clientWidth + 1);
        }));
        assert.equal(controls.length, 3);
        assert.ok(controls.every(Boolean), 'search controls and button text must fit; single-line input may scroll internally');
      };
      for (const scale of ['115', '130']) {
        await page.locator('[aria-controls="display-settings"]').click();
        await page.locator('[data-display-scale]').selectOption(scale);
        await page.locator('[data-display-done]').click();
        await search('  TrAiL RaTiOnS  ');
        assert.equal(await page.locator('#bag-search-input').inputValue(), 'TrAiL RaTiOnS');
        assert.deepEqual(await inventoryNames.allTextContents(), allNames);
        assert.equal(await recipes.count(), 2, 'rations match both broth/chowder ingredient recipes');
        await click('bagSort', 'value');
        await unchanged();
        assert.equal(await page.locator('#bag-search-input').inputValue(), 'TrAiL RaTiOnS');
        assert.equal(await page.locator('[data-action="bagSort"][data-arg="value"]').getAttribute('aria-pressed'), 'true');
        await search('storm glass');
        assert.equal(await inventoryNames.count(), 0);
        assert.equal(await recipes.count(), 10, 'ingredient search includes recipes without owning that ingredient');
        await searchFit(`bag-search-glass-${scale}`);
        const longQuery = 'x'.repeat(120);
        await search(longQuery);
        assert.equal(await inventoryNames.count(), 0);
        assert.equal(await recipes.count(), 0);
        assert.ok((await page.locator('.bag-empty').textContent()).includes(longQuery));
        await searchFit(`bag-search-long-${scale}`);
        const glyphs = await page.locator('.bag-empty').evaluate(node => {
          const range = document.createRange(); range.selectNodeContents(node);
          return [...range.getClientRects()].map(r => ({ left: r.left, right: r.right }));
        });
        assert.ok(glyphs.length > 0 && glyphs.every(r => r.left >= 0 && r.right <= width + 1), 'visible no-match text must wrap inside the viewport');
        await search('<img src=x onerror=alert(1)>');
        assert.equal(await page.locator('.bag-empty img').count(), 0, 'query markup is escaped');
        assert.ok((await page.locator('.bag-empty').textContent()).includes('<img src=x onerror=alert(1)>'));
        await click('bagSearchClear');
        await unchanged();
        assert.equal(await page.locator('#bag-search-input').inputValue(), '');
        assert.deepEqual(await inventoryNames.allTextContents(), allNames);
        assert.equal(await recipes.count(), allRecipes);
        assert.equal(await page.locator('[data-action="bagSort"][data-arg="value"]').getAttribute('aria-pressed'), 'true');
        await search('storm glass'); await click('leave');
        assert.deepEqual(await state(), town);
        await click('bag');
        assert.equal(await page.locator('#bag-search-input').inputValue(), '', 'reopening resets the transient query');
        assert.equal(await page.locator('[data-action="bagSort"][data-arg="value"]').getAttribute('aria-pressed'), 'true');
        await unchanged();
        await searchFit(`bag-search-reopened-${scale}`);
      }
      await page.locator('[aria-controls="display-settings"]').click();
      await page.locator('[data-display-scale]').selectOption('100');
      await page.locator('[data-display-done]').click();
      await unchanged(); await click('leave');
      assert.deepEqual(await state(), town);
    };
    const readOnlyVisit = async (action, title) => {
      const before = await progress();
      // Bag rendering initializes missing empty slots; this changes only our
      // expected snapshot, never live game state. All other fields stay strict.
      if (action === 'bag' && !before.party[0].equipment) {
        before.party[0].equipment = { weapon: null, armor: null, trinket: null };
      }
      await click(action);
      assert.match(await page.locator('main h1, main h2').first().innerText(), title);
      await fit(action);
      if (action === 'muster') {
        for (const scale of ['115', '130']) {
          await page.locator('[aria-controls="display-settings"]').click();
          await page.locator('[data-display-scale]').selectOption(scale);
          await page.locator('[data-display-done]').click();
          await fit(`muster-text-${scale}`);
          assert.deepEqual(await progress(), before, 'larger text must not change party progress');
          const headings = await page.locator('.muster-section-heading').evaluateAll(rows => rows.map(row => {
            const bounds = row.getBoundingClientRect();
            return [...row.children].every(child => {
              const rect = child.getBoundingClientRect();
              return rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1;
            });
          }));
          assert.deepEqual(headings, [true, true], 'Muster heading and count must fit without clipping');
        }
        await page.locator('[aria-controls="display-settings"]').click();
        await page.locator('[data-display-scale]').selectOption('100');
        await page.locator('[data-display-done]').click();
      }
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
      await checkBagSearch();
      await click('explore');
      const inField = await progress();
      await click('openQuests'); await click('filterQuests', 'all'); await click('leave');
      assert.equal((await state()).scene, 'explore');
      assert.deepEqual(await progress(), inField);
      await fit('explore');
      // Opt out using the actual device-local control, without altering progress.
      await setShortcuts(false);
      const beforeMapKeys = await state();
      assert.equal(await page.locator('[data-action="moveEast"]').getAttribute('aria-keyshortcuts'), 'ArrowRight');
      assert.equal(await page.locator('[data-action="waitTurn"]').getAttribute('aria-keyshortcuts'), null);
      for (const key of ['w', 'a', 's', 'd', 'e', '1', '9', 'Numpad1']) {
        await page.keyboard.press(key);
        assert.deepEqual(await state(), beforeMapKeys, `${key}: opted-out exploration shortcut acted`);
      }
      await page.keyboard.press('ArrowRight');
      assert.equal((await state()).map.x, beforeMapKeys.map.x + 1);
      await click('moveWest');
      assert.equal((await state()).map.x, beforeMapKeys.map.x);
      const beforeSurvey = await state();
      await page.locator('[data-action="waitTurn"]').focus();
      await page.keyboard.press('Enter');
      assert.notDeepEqual((await state()).map.log, beforeSurvey.map.log, 'native Survey still works');
      await click('moveNorth'); // Adjacent to Mara at (3, 2), not a walk-through tile.
      assert.ok(await page.locator('.nearby-action').count() > 0);
      assert.equal(await page.locator('.nearby-action[aria-keyshortcuts]').count(), 0);
      const beforeNearby = await state();
      const nearbyText = await page.locator('#app').innerText();
      await page.keyboard.press('1');
      assert.deepEqual(await state(), beforeNearby, 'opted-out nearby action changed state');
      assert.equal(await page.locator('#app').innerText(), nearbyText, 'opted-out nearby action opened dialogue');
      await fit('explore-shortcuts-off');
      await click('save'); await page.reload(); await click('continue');
      assert.equal(await page.locator('html').getAttribute('data-character-shortcuts'), 'off');
      if ((await state()).scene === 'town') await click('explore');
      const afterReload = await state();
      await page.keyboard.press('d');
      assert.deepEqual(await state(), afterReload, 'opt-out must persist after reload');
      await setShortcuts(true);
      await page.keyboard.press('s');
      assert.equal((await state()).map.y, afterReload.map.y + 1);
      await page.keyboard.press('w');
      assert.equal((await state()).map.y, afterReload.map.y);
      const beforeEnabledSurvey = await state();
      await page.keyboard.press('e');
      assert.notDeepEqual((await state()).map.log, beforeEnabledSurvey.map.log, 're-enabled Survey works');
      assert.equal((await state()).story.stage, 'briefing');
      assert.equal(await page.locator('.nearby-action[aria-keyshortcuts="1"]').getAttribute('data-arg'), 'mara');
      await page.keyboard.press('1');
      assert.equal((await state()).story.stage, 'road', 're-enabled nearby shortcut talks to Mara');
      await click('moveSouth');
      // Greyhaven's east exit leads to the ridge; the fixed patrol is four steps east.
      for (let step = 0; step < 6; step++) await click('moveEast');
      assert.equal((await state()).map.zoneId, 'ridge_road');
      for (let step = 0; step < 4; step++) await click('moveEast');
      assert.equal((await state()).scene, 'combat');
      await fit('combat');
      const beforeCommands = await state();
      assert.equal(await page.locator('[data-action="burst"]').isDisabled(), true);
      for (const key of ['b', 'Shift+a', 'Control+a']) {
        await page.keyboard.press(key);
        assert.deepEqual(await state(), beforeCommands, `${key}: unavailable/modified shortcut acted`);
      }
      await page.locator('[aria-controls="display-settings"]').click();
      await page.keyboard.press('a');
      assert.deepEqual(await state(), beforeCommands, 'display settings must block combat shortcuts');
      await page.locator('[data-display-done]').click();
      await page.keyboard.press('s');
      assert.ok(await page.locator('[data-action="skill"]').count() > 0);
      assert.deepEqual(await state(), beforeCommands, 'opening skills must not take a turn');
      await fit('combat-skills');
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('[data-action="attack"]').count(), 1);
      await page.keyboard.press('i');
      assert.ok(await page.locator('[data-action="item"]').count() > 0);
      assert.deepEqual(await state(), beforeCommands, 'opening items must not take a turn');
      await fit('combat-items');
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('[data-action="attack"]').count(), 1);
      assert.deepEqual(await state(), beforeCommands, 'closing command menus must not take a turn');
      await setShortcuts(false);
      const beforeDisabledCombat = await state();
      for (const key of ['a', 's', 'i', 'd', 'f', 'b', 'c']) {
        await page.keyboard.press(key);
        assert.deepEqual(await state(), beforeDisabledCombat, `${key}: opted-out combat shortcut acted`);
        assert.equal(await page.locator('[data-action="attack"]').count(), 1, `${key}: opted-out shortcut changed menus`);
      }
      assert.equal(await page.locator('[data-action="attack"] .key-hint').isVisible(), false);
      for (const [menu, action] of [['skills', 'skill'], ['items', 'item']]) {
        await click('menu', menu);
        assert.equal(await page.locator(`[data-action="${action}"]`).first().isEnabled(), true);
        for (const key of ['1', 'Numpad1']) {
          await page.keyboard.press(key);
          assert.deepEqual(await state(), beforeDisabledCombat, `${key}: opted-out ${menu} shortcut acted`);
          assert.ok(await page.locator(`[data-action="${action}"]`).count() > 0);
        }
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('[data-action="attack"]').count(), 1, 'Escape still closes menus');
        assert.deepEqual(await state(), beforeDisabledCombat);
      }
      await fit('combat-shortcuts-off');
      await page.locator('[data-action="attack"]').focus();
      await page.keyboard.press('Enter');
      assert.ok((await state()).combat.enemy.hp < beforeDisabledCombat.combat.enemy.hp, 'native Attack still works');
      await setShortcuts(true);
      for (let turn = 0; turn < 40 && !(await state()).combat.over; turn++) await page.keyboard.press('a');
      assert.equal((await state()).combat.over, 'victory');
      assert.match(await page.locator('.battle-summary').innerText(), /\d+ rounds? · \d+ damage dealt · \d+ damage taken/);
      await fit('victory');
      const beforeChronicle = await state();
      assert.ok(beforeChronicle.combat.log.length > 8, 'earned fight retains more than the live-log window');
      await page.locator('.battle-chronicle summary').click();
      assert.deepEqual(await page.locator('.battle-chronicle__list li').allTextContents(), beforeChronicle.combat.log);
      assert.deepEqual(await state(), beforeChronicle, 'reading the full chronicle must not change state');
      await fit('battle-chronicle');
      await setShortcuts(false);
      const beforeFinish = await state();
      assert.equal(await page.locator('[data-action="finish"]').isEnabled(), true);
      await page.keyboard.press('c');
      assert.deepEqual(await state(), beforeFinish, 'opted-out Finish must not leave a resolved battle');
      await setShortcuts(true);
      await page.keyboard.press('c');
      assert.equal((await state()).scene, 'explore');
      assert.equal((await state()).combat, null);
      assert.equal((await state()).map.clearedEncounters.ridge_patrol, true);
      await click('save');
      const saved = await state();
      await page.reload(); await click('continue');
      assert.equal((await state()).scene, 'explore');
      assert.deepEqual((await state()).story, saved.story);
      assert.deepEqual((await state()).party, saved.party);
      assert.equal((await state()).gold, saved.gold);
      assert.equal((await state()).map.clearedEncounters.ridge_patrol, true);
      const beforeJournal = await state();
      await click('openJournal');
      const journalState = await state();
      assert.deepEqual({ ...journalState, scene: 'explore' }, beforeJournal);
      assert.match(await page.locator('main').innerText(), /Ridge Bandit/);
      assert.equal(await page.locator('[data-action="compareFoe"]').count(), 1, 'only the earned foe can be compared');
      assert.equal(await page.locator('.comparison-card').count(), 0);
      await click('compareFoe', 'ridge_bandit');
      assert.equal(await page.locator('.comparison-card[data-comparison-enemy="ridge_bandit"]').count(), 1);
      assert.equal(await page.locator('.bestiary-entry [data-action="removeComparedFoe"][data-arg="ridge_bandit"]').getAttribute('aria-pressed'), 'true');
      assert.deepEqual(await state(), journalState, 'comparison must not change progress');
      for (const scale of ['115', '130']) {
        await page.locator('[aria-controls="display-settings"]').click();
        await page.locator('[data-display-scale]').selectOption(scale);
        await page.locator('[data-display-done]').click();
        await fit(`earned-comparison-text-${scale}`);
        assert.deepEqual(await state(), journalState);
      }
      await page.locator('[aria-controls="display-settings"]').click();
      await page.locator('[data-display-scale]').selectOption('100');
      await page.locator('[data-display-done]').click();
      await page.locator('.comparison-card [data-action="removeComparedFoe"]').click();
      assert.equal(await page.locator('.comparison-card').count(), 0);
      assert.deepEqual(await state(), journalState);
      await click('compareFoe', 'ridge_bandit');
      assert.equal(await page.locator('.comparison-card').count(), 1);
      await click('clearComparison');
      assert.equal(await page.locator('.comparison-card').count(), 0);
      assert.deepEqual(await state(), journalState, 'Remove/re-add/Clear must not change progress');
      await fit('earned-bestiary'); await click('leave');
      assert.deepEqual(await state(), beforeJournal, 'Back must restore the whole expedition state');
      // Three manual checkpoints, earned through the same fresh-game route.
      const archiveOriginal = await state();
      const archiveKey = id => `stormhaven.archive.v1.${id}`;
      const stored = key => page.evaluate(key => localStorage.getItem(key), key);
      const quickSave = await stored('stormhaven-save');
      await click('openArchive');
      const archiveOpen = { ...archiveOriginal, scene: 'archive' };
      assert.deepEqual(await state(), archiveOpen);
      for (const id of ['1', '2']) {
        await click('saveArchive', id);
        assert.deepEqual(JSON.parse(await stored(archiveKey(id))).state, archiveOriginal);
      }
      const slotOne = await stored(archiveKey('1'));
      await page.locator('[aria-controls="display-settings"]').click();
      await page.locator('[data-display-scale]').selectOption('130');
      await page.locator('[data-display-done]').click();
      await fit('earned-archive-text-130');
      const archiveButtons = await page.locator('.archive-buttons button').evaluateAll(buttons => buttons.map(button => {
        const rect = button.getBoundingClientRect();
        return { left: rect.left, right: rect.right, height: rect.height, client: button.clientWidth, scroll: button.scrollWidth };
      }));
      assert.equal(archiveButtons.length, 9);
      for (const button of archiveButtons) {
        assert.ok(button.left >= 0 && button.right <= width && button.height >= 44);
        assert.ok(button.scroll <= button.client + 1, 'archive control text must not overflow');
      }
      assert.deepEqual(await state(), archiveOpen);
      await click('saveArchive', '1'); await click('cancelArchive');
      assert.equal(await stored(archiveKey('1')), slotOne);
      await click('leaveArchive'); assert.deepEqual(await state(), archiveOriginal);
      await click('moveWest');
      const archiveChanged = await state();
      assert.equal(archiveChanged.scene, 'explore');
      assert.equal(archiveChanged.map.x, archiveOriginal.map.x - 1, 'ordinary westward step creates a distinct checkpoint');
      await click('openArchive'); await click('saveArchive', '3');
      assert.deepEqual(JSON.parse(await stored(archiveKey('3'))).state, archiveChanged);
      const changedOpen = await state();
      await click('loadArchive', '1'); await click('cancelArchive');
      assert.deepEqual(await state(), changedOpen);
      await click('loadArchive', '1'); await click('confirmArchive');
      assert.deepEqual(await state(), archiveOriginal, 'archive load restores the entire earned expedition');
      await click('openArchive');
      await click('saveArchive', '3'); await click('confirmArchive');
      assert.deepEqual(JSON.parse(await stored(archiveKey('3'))).state, archiveOriginal);
      const slotTwo = await stored(archiveKey('2'));
      await click('deleteArchive', '2'); await click('cancelArchive');
      assert.equal(await stored(archiveKey('2')), slotTwo);
      await click('deleteArchive', '2'); await click('confirmArchive');
      assert.equal(await stored(archiveKey('2')), null);
      assert.equal(await stored('stormhaven-save'), quickSave);
      await click('leaveArchive'); assert.deepEqual(await state(), archiveOriginal);
      await page.reload(); await click('archive');
      assert.equal(await page.locator('[data-action="saveArchive"]:disabled').count(), 3);
      await click('loadArchive', '1'); await click('confirmArchive');
      assert.deepEqual(await state(), archiveOriginal, 'Title archive load restores the whole expedition');
      assert.equal(await stored('stormhaven-save'), quickSave);
      await page.locator('[aria-controls="display-settings"]').click();
      await page.locator('[data-display-scale]').selectOption('100');
      await page.locator('[data-display-done]').click();
      assert.deepEqual(await state(), archiveOriginal);
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}px: navigation, filters, purchase, save/reload, readonly Bag search/recipe filters/long-query wrapping, shortcut opt-out/persistence/re-enable, combat shortcuts, full chronicle, earned ridge victory/comparison, archive confirmations/round-trip; browser errors []`);
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
