import test from 'node:test';
import assert from 'node:assert/strict';
import { zoneArt } from '../src/ui/zoneArt.js';
import { foeArt } from '../src/ui/bestiary.js';
import { ENEMIES } from '../src/data/enemies.js';

// Scenic vistas and foe portraits are drawn in an angular, straight-line style.
// Curves are where rounded blob shapes hide, so they are tightly controlled:
//  - only <path> elements may draw (no circle/ellipse/rect/polygon/use/image);
//  - arc commands (A/a) are never allowed;
//  - filled paths must be straight-line only (M L H V Z);
//  - an unfilled curved stroke must match REVIEWED_CURVES exactly.
// To add a new curved stroke, render it, have a second reviewer look at the
// picture, then add its exact path data below in the same merge request.
const REVIEWED_CURVES = new Set([
  'M35 128q38-19 73 0t77-1', // spectre portrait: a single open wind ribbon
]);

const ZONE_IDS = [
  'greyhaven', 'ridge_road', 'observatory_ruins', 'beacon_tower', 'saltmere_coast',
  'highwatch_pass', 'sunscar_relay', 'stormcrown_spire', 'storms_eye', 'uncharted_frontier',
];
const DRAW_TAGS = new Set(['svg', 'title', 'desc', 'g', 'path']);

function artSamples() {
  const samples = ZONE_IDS.map((id) => [`vista ${id}`, zoneArt(id)]);
  for (const [id, enemy] of Object.entries(ENEMIES)) samples.push([`portrait ${id}`, foeArt({ ...enemy, id })]);
  return samples;
}

const PATH_ATTRS = new Set(['d', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'opacity']);

// Attributes may use either quote style; anything unquoted or unparseable is reported.
function attrList(attrs) {
  const found = [];
  const rest = attrs.replace(/\s([\w:-]+)\s*=\s*(["'])([\s\S]*?)\2/g, (_, name, __, value) => {
    found.push([name.toLowerCase(), value]);
    return ' ';
  });
  return { found, leftover: rest.replace(/\/\s*$/, '').trim() };
}

function paths(svg) {
  return [...svg.matchAll(/<path\b([^>]*)>/gi)].map(([, attrs]) => {
    const { found, leftover } = attrList(attrs);
    const get = (name) => found.find(([n]) => n === name)?.[1];
    return {
      d: get('d') ?? '',
      fill: (get('fill') ?? 'black').trim().toLowerCase(),
      extras: found.map(([n]) => n).filter((n) => !PATH_ATTRS.has(n)),
      dCount: found.filter(([n]) => n === 'd').length,
      leftover,
    };
  });
}

function artProblems(label, svg) {
  const problems = [];
  const tags = new Set([...svg.matchAll(/<([a-zA-Z][\w:-]*)/g)].map((m) => m[1].toLowerCase()));
  for (const tag of tags) if (!DRAW_TAGS.has(tag)) problems.push(`${label} uses <${tag}>`);
  for (const { d, fill, extras, dCount, leftover } of paths(svg)) {
    if (!d.trim() || dCount !== 1) { problems.push(`${label} has a path without exactly one readable d`); continue; }
    if (leftover) problems.push(`${label} has an unparsed path attribute: ${leftover}`);
    if (extras.length) problems.push(`${label} uses path attributes outside the art set: ${extras.join(', ')}`);
    if (/[Aa]/.test(d)) problems.push(`${label} uses an arc: ${d}`);
    if (!/[CcSsQqTt]/.test(d)) continue;
    if (fill !== 'none') problems.push(`${label} fills a curved path: ${d}`);
    else if (!REVIEWED_CURVES.has(d)) problems.push(`${label} adds an unreviewed curved stroke: ${d}`);
  }
  return problems;
}

test('every vista and portrait passes the shape guard', () => {
  const samples = artSamples();
  assert.ok(samples.length >= ZONE_IDS.length + 25, 'expected vistas plus every foe portrait');
  for (const [label, svg] of samples) {
    assert.ok(paths(svg).length > 0, `${label} has no paths`);
    assert.deepEqual(artProblems(label, svg), []);
  }
});

test('the guard flags curved fills, arcs, stray elements and unreviewed strokes', () => {
  const ok = '<svg><g><path fill="#30485b" d="m340 111 60-57 61 57-20 76h-82Z"/></g></svg>';
  assert.deepEqual(artProblems('angular', ok), []);
  assert.equal(artProblems('filled', '<svg><path fill="#888" d="M10 10c20-10 40 10 20 20Z"/></svg>').length, 1);
  assert.equal(artProblems('arc', '<svg><path fill="none" d="M10 10a5 5 0 0 1 10 0"/></svg>').length, 1);
  assert.equal(artProblems('stroke', '<svg><path fill="none" d="M10 10q5 5 10 0"/></svg>').length, 1);
  assert.equal(artProblems('shape', '<svg><polygon points="0,0 1,1 1,0"/></svg>').length, 1);
  assert.deepEqual(artProblems('reviewed', '<svg><path fill="none" d="M35 128q38-19 73 0t77-1"/></svg>'), []);
  // Bypass regressions: quoting, missing data, casing and styling tricks are all reported.
  assert.ok(artProblems('single quotes', "<svg><path fill='#888' d='M10 10c20-10 40 10 20 20Z'/></svg>").length >= 1);
  assert.ok(artProblems('mixed quotes', `<svg><path fill="#888" d='M10 10c20-10 40 10 20 20Z'/></svg>`).length >= 1);
  assert.ok(artProblems('missing d', '<svg><path fill="#888"/></svg>').length >= 1);
  assert.ok(artProblems('empty d', '<svg><path fill="#888" d=""/></svg>').length >= 1);
  assert.ok(artProblems('two d', '<svg><path fill="none" d="M0 0h1" d="M10 10c20-10 40 10 20 20Z"/></svg>').length >= 1);
  assert.ok(artProblems('unquoted d', '<svg><path fill="#888" d=M10,10c20-10,40,10,20,20Z/></svg>').length >= 1);
  assert.ok(artProblems('upper case', '<svg><PATH FILL="#888" D="M10 10c20-10 40 10 20 20Z"/></svg>').length >= 1);
  assert.ok(artProblems('styled fill', '<svg><path fill="none" style="fill:#888" d="M10 10q5 5 10 0"/></svg>').length >= 1);
  assert.ok(artProblems('class fill', '<svg><path fill="none" class="blob" d="M0 0h10v10Z"/></svg>').length >= 1);
  assert.ok(artProblems('spaced equals', '<svg><path fill = "#888" d = "M10 10c20-10 40 10 20 20Z"/></svg>').length >= 1);
  assert.ok(artProblems('style tag', '<svg><style>path{fill:#888}</style><path fill="none" d="M0 0h1"/></svg>').length >= 1);
});
