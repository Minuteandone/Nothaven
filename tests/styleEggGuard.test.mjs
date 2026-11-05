import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { assertEggFree } from './eggGuard.mjs';

test('style.css ships no egg vocabulary in selectors, values or comments', () => {
  const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
  // .game-shell is the long-standing app-frame class and the only known
  // benign 'shell' token; mask exactly that identifier before scanning so
  // any other shell/egg vocabulary still fails loudly.
  const scanned = css.replaceAll('game-shell', 'app-frame');
  assertEggFree(scanned, 'style.css');
});
