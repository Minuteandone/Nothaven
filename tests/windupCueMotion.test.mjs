import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');

test('windup cue pulse exists and is switched off for reduced motion', () => {
  assert.match(css, /\.windup-cue \{ animation: windup-pulse [^}]*\}/);
  assert.match(css, /@keyframes windup-pulse \{/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.windup-cue \{ animation: none; \}/);
  assert.match(css, /html\[data-motion="reduced"\] \.windup-cue \{ animation: none; \}/);
});
