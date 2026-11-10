// Guards against egg emoji smuggled in as escapes (CSS `\1F95A`, JS `\u{1F95A}`
// or surrogate pairs, HTML `&#x1F95A;` / `&#129370;`), which the literal
// emoji check in eggGuard cannot see.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { EGG_RE } from './helpers/eggGuard.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const EGG_CODEPOINTS = new Set([0x1F95A, 0x1F373, 0x1F423, 0x1F424, 0x1F425, 0x1F414, 0x1FABA, 0x1FAB9]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(js|mjs|css|html)$/.test(name)) out.push(p);
  }
  return out;
}

export function decodedEscapes(text) {
  const found = [];
  const push = (cp, raw) => { if (Number.isFinite(cp) && cp >= 0 && cp <= 0x10FFFF) found.push({ ch: String.fromCodePoint(cp), cp, raw }); };
  for (const m of text.matchAll(/\\u\{([0-9a-f]{1,6})\}/gi)) push(parseInt(m[1], 16), m[0]);
  for (const m of text.matchAll(/\\u(d[89ab][0-9a-f]{2})\\u(d[c-f][0-9a-f]{2})/gi)) {
    const hi = parseInt(m[1], 16); const lo = parseInt(m[2], 16);
    push((hi - 0xD800) * 0x400 + (lo - 0xDC00) + 0x10000, m[0]);
  }
  for (const m of text.matchAll(/&#x([0-9a-f]{1,6});/gi)) push(parseInt(m[1], 16), m[0]);
  for (const m of text.matchAll(/&#([0-9]{1,7});/g)) push(parseInt(m[1], 10), m[0]);
  // CSS escapes: backslash + 1-6 hex digits (only meaningful in CSS/HTML-ish strings).
  for (const m of text.matchAll(/\\([0-9a-f]{4,6})(?![0-9a-f])/gi)) push(parseInt(m[1], 16), m[0]);
  return found;
}

test('decodedEscapes recognises every escape form', () => {
  const cps = decodedEscapes('a{content:"\\1F95A "} "\\u{1F373}" "\\uD83E\\uDD5A" &#x1F423; &#129370;').map((e) => e.cp);
  assert.deepEqual(cps, [0x1F373, 0x1F95A, 0x1F423, 0x1F95A, 0x1F95A]);
});

test('no source file smuggles an egg emoji through an escape sequence', () => {
  const files = [join(ROOT, 'style.css'), join(ROOT, 'index.html'), ...walk(join(ROOT, 'src'))];
  const hits = [];
  for (const f of files) {
    let text;
    try { text = readFileSync(f, 'utf8'); } catch { continue; }
    for (const e of decodedEscapes(text)) {
      if (EGG_CODEPOINTS.has(e.cp) || EGG_RE.test(e.ch)) hits.push(`${f.replace(ROOT, '')}: ${e.raw}`);
    }
  }
  assert.deepEqual(hits, []);
});
