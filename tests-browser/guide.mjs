import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifacts = path.join(root, 'browser-artifacts', 'guide');
await mkdir(artifacts, { recursive: true });
const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const relative =
      pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1));
    const file = path.resolve(root, relative);
    const allowed =
      ['index.html', 'style.css'].includes(relative) ||
      (relative.startsWith('src/') &&
        file.startsWith(path.join(root, 'src') + path.sep));
    if (!allowed) {
      res.writeHead(404);
      res.end();
      return;
    }
    const data = await readFile(file);
    const type =
      { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' }[
        path.extname(file)
      ] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

// Literal expectations are independent of the production Guide catalogue.
const rows = [
  ['Exploring', 6, 'guide-exploring'],
  ['Battle', 8, 'guide-battle'],
  ['Elements', 5, 'guide-elements'],
  ['Conditions', 3, 'guide-conditions'],
  ['Party and growth', 4, 'guide-party-and-growth'],
  ['Settings and saving', 17, 'guide-settings-and-saving'],
  ['Skill roadmap', 15, 'guide-skill-roadmap'],
];
let browser;
try {
  browser = await chromium.launch({ headless: true });
  for (const width of [320, 375, 768]) {
    const context = await browser.newContext({
      viewport: { width, height: 800 },
    });
    const page = await context.newPage(),
      errors = [];
    page.setDefaultTimeout(10000);
    page.on('pageerror', (e) => errors.push(e.message));
    await context.tracing.start({ screenshots: true, snapshots: true });
    const control = (a) => page.locator(`#app [data-action="${a}"]`).first();
    // Evaluation observes the whole journey and raw quick save; it never changes either.
    const snapshot = () =>
      page.evaluate(() => ({
        state: structuredClone(window.game.state),
        quick: localStorage.getItem('stormhaven-save'),
      }));
    const inView = async (id) => {
      const b = await page.locator(`#${id} h2`).boundingBox();
      assert.ok(
        b && b.y >= -1 && b.y + b.height <= 801,
        `${id} heading in viewport: ${JSON.stringify(b)}`,
      );
    };
    // Viewport containment alone misses headings hidden beneath the sticky dock.
    const contentsClear = async () => {
      await inView('guide-contents');
      const b = await page.evaluate(() => {
        const h = document
            .querySelector('#guide-contents h2')
            .getBoundingClientRect(),
          d = document.querySelector('.audio-dock').getBoundingClientRect();
        return { top: h.top, bottom: h.bottom, dockBottom: d.bottom };
      });
      assert.ok(
        b.top >= b.dockBottom + 1,
        `Contents clears measured dock: ${JSON.stringify(b)}`,
      );
    };
    try {
      await page.goto(base);
      await control('guide').click();
      const before = await snapshot();
      assert.equal(before.quick, null);
      for (const scale of ['115', '130']) {
        await page.locator('[aria-controls="display-settings"]').click();
        await page.locator('[data-display-scale]').selectOption(scale);
        await page.locator('[data-display-done]').click();
        const nav = page.locator('nav.guide-toc'),
          links = nav.locator('a');
        assert.equal(await nav.getAttribute('id'), 'guide-contents');
        assert.equal(await page.locator('#guide-contents').count(), 1);
        assert.equal(
          await page.locator('.guide-section__back-link').count(),
          7,
        );
        assert.equal(await nav.getAttribute('aria-label'), 'Guide contents');
        assert.equal(await nav.getAttribute('aria-live'), null);
        assert.notEqual(await nav.getAttribute('role'), 'status');
        assert.equal(await links.count(), 7);
        await nav.scrollIntoViewIfNeeded();
        await page.mouse.move(0, 0);
        await page.waitForTimeout(250);
        for (const [i, [title, count, id]] of rows.entries()) {
          const link = links.nth(i);
          assert.equal(await link.textContent(), `${title} (${count})`);
          assert.equal(await link.getAttribute('href'), `#${id}`);
          assert.equal(await page.locator(`section#${id}`).count(), 1);
          assert.equal(await page.locator(`#${id} h2`).textContent(), title);
          assert.ok(
            await link.evaluate((n) => {
              const b = n.getBoundingClientRect(),
                r = document.createRange();
              r.selectNodeContents(n);
              return (
                b.height >= 44 &&
                b.left >= 0 &&
                b.right <= innerWidth + 1 &&
                [...r.getClientRects()].every(
                  (g) =>
                    g.left >= b.left - 1 &&
                    g.right <= b.right + 1 &&
                    g.top >= b.top - 1 &&
                    g.bottom <= b.bottom + 1,
                )
              );
            }),
            `${title} geometry`,
          );
        }
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth),
          width,
        );
        assert.deepEqual(await snapshot(), before);
        await page.screenshot({
          path: `${artifacts}/${width}-contents-${scale}.png`,
          fullPage: true,
        });
        for (const [title, count, id] of rows) {
          await page.locator(`nav a[href="#${id}"]`).click();
          assert.equal(new URL(page.url()).hash, `#${id}`);
          await inView(id);
          const boxes = await page.evaluate((id) => {
            const h = document
                .querySelector(`#${id} h2`)
                .getBoundingClientRect(),
              d = document.querySelector('.audio-dock').getBoundingClientRect();
            return {
              heading: { top: h.top, bottom: h.bottom },
              dock: { top: d.top, bottom: d.bottom },
            };
          }, id);
          assert.ok(
            boxes.heading.top >= boxes.dock.bottom + 1,
            `${width}/${scale}/${id} clears dock: ${JSON.stringify(boxes)}`,
          );
          if (title === 'Elements')
            await page.screenshot({
              path: `${artifacts}/${width}-elements-${scale}-viewport.png`,
            });
          assert.deepEqual(await snapshot(), before);
          if (title === 'Battle' && scale === '130')
            await page.screenshot({
              path: `${artifacts}/${width}-battle-130.png`,
              fullPage: true,
            });
          const back = page.locator(`#${id} .guide-section__back-link`);
          assert.equal(await back.count(), 1);
          assert.equal(await back.textContent(), 'Back to contents');
          assert.equal(await back.getAttribute('href'), '#guide-contents');
          assert.equal(await back.getAttribute('data-action'), null);
          await back.scrollIntoViewIfNeeded();
          await page.mouse.move(0, 0);
          await page.waitForTimeout(250);
          assert.ok(
            await back.evaluate((n) => {
              const b = n.getBoundingClientRect(),
                r = document.createRange();
              r.selectNodeContents(n);
              return (
                b.height >= 44 &&
                b.left >= 0 &&
                b.right <= innerWidth + 1 &&
                [...r.getClientRects()].every(
                  (g) =>
                    g.left >= b.left - 1 &&
                    g.right <= b.right + 1 &&
                    g.top >= b.top - 1 &&
                    g.bottom <= b.bottom + 1,
                )
              );
            }),
            `${title} back link bounds`,
          );
          assert.equal(
            await page.evaluate(() => document.documentElement.scrollWidth),
            width,
          );
          if (title === 'Elements')
            await page.screenshot({
              path: `${artifacts}/${width}-back-link-${scale}-viewport.png`,
            });
          await back.click();
          assert.equal(new URL(page.url()).hash, '#guide-contents');
          await contentsClear();
          assert.deepEqual(await snapshot(), before);
          if (title === 'Elements')
            await page.screenshot({
              path: `${artifacts}/${width}-returned-contents-${scale}-viewport.png`,
            });
        }
      }
      await control('closeGuide').click();
      assert.equal((await snapshot()).state.scene, 'title');
      assert.equal((await snapshot()).quick, before.quick);
      await control('guide').click();
      assert.deepEqual(await snapshot(), before);
      // Native keyboard roundtrip: reach the roadmap, then its next-Tab return link.
      let found = false;
      for (let n = 0; n < 30; n++) {
        await page.keyboard.press('Tab');
        if (
          await page.evaluate(
            () =>
              document.activeElement?.getAttribute('href') ===
              '#guide-skill-roadmap',
          )
        ) {
          found = true;
          break;
        }
      }
      assert.ok(found, 'roadmap reachable by Tab');
      await page.keyboard.press('Enter');
      assert.equal(new URL(page.url()).hash, '#guide-skill-roadmap');
      await inView('guide-skill-roadmap');
      assert.deepEqual(await snapshot(), before);
      await page.keyboard.press('Tab');
      assert.ok(
        await page.evaluate(
          () =>
            document.activeElement?.classList.contains(
              'guide-section__back-link',
            ) &&
            document.activeElement.getAttribute('href') === '#guide-contents',
        ),
        'roadmap back link is next native Tab stop',
      );
      await page.keyboard.press('Enter');
      assert.equal(new URL(page.url()).hash, '#guide-contents');
      await contentsClear();
      assert.deepEqual(await snapshot(), before);
      await control('closeGuide').click();
      await control('newGame').click();
      assert.equal((await snapshot()).state.scene, 'town');
      assert.equal((await snapshot()).quick, null);
      assert.deepEqual(errors, []);
      console.log(
        `PASS ${width}: seven literal links and native destinations at115/130, link/text/document bounds, every clicked section and Contents heading clears measured dock, seven bounded 44px back links, Tab/Enter roadmap and return, Back/reopen/New journey, whole state and quicksave stable; errors []`,
      );
    } catch (e) {
      await page
        .screenshot({
          path: `${artifacts}/${width}-failure.png`,
          fullPage: true,
        })
        .catch(() => {});
      throw e;
    } finally {
      await context.tracing.stop({ path: `${artifacts}/${width}.zip` });
      await context.close();
    }
  }
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
