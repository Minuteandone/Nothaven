import test from 'node:test';
import assert from 'node:assert/strict';
import { companionTechniqueLine } from '../src/ui/muster.js';
import { COMPANIONS } from '../src/party/companions.js';

const get = (id) => (Array.isArray(COMPANIONS) ? COMPANIONS.find(c => c.id === id) : COMPANIONS[id]);

test('companionTechniqueLine returns technique HTML for each role', () => {
  // Tamsin is a scout
  const tamsin = get('tamsin');
  const html = companionTechniqueLine(tamsin);
  assert.ok(html.includes('companion-technique'), 'has technique class');
  assert.ok(html.includes('Aimed Shot'), 'scout mentions Aimed Shot');
  assert.ok(html.includes('30% chance'), 'scout describes 30% chance');
  assert.ok(html.includes('140%'), 'scout describes 140% damage');

  // Iven is a keeper
  const iven = get('iven');
  const html2 = companionTechniqueLine(iven);
  assert.ok(html2.includes('Mend'), 'keeper mentions Mend');
  assert.ok(html2.includes('Spark'), 'keeper mentions Spark');
  assert.ok(html2.includes('Lightning'), 'keeper mentions Lightning');
  assert.ok(html2.includes('favours constructs'), 'keeper notes construct preference');

  // Bram is a guardian
  const bram = get('bram');
  const html3 = companionTechniqueLine(bram);
  assert.ok(html3.includes('Shield Bash'), 'guardian mentions Shield Bash');
  assert.ok(html3.includes('25% chance'), 'guardian mentions 25% chance');
  assert.ok(html3.includes('stun'), 'guardian mentions stun');

  // Sela is a signaler
  const sela = get('sela');
  const html4 = companionTechniqueLine(sela);
  assert.ok(html4.includes('Signal Flare'), 'signaler mentions Signal Flare');
  assert.ok(html4.includes('Fire'), 'signaler mentions Fire');
  assert.ok(html4.includes('ignores armour'), 'signaler notes ignores armour');
});

test('companionTechniqueLine returns empty string for unknown role', () => {
  assert.equal(companionTechniqueLine({ role: 'wizard' }), '');
  assert.equal(companionTechniqueLine({ role: null }), '');
  assert.equal(companionTechniqueLine(null), '');
  assert.equal(companionTechniqueLine(undefined), '');
});

test('companionTechniqueLine uses <strong> tags for skill names', () => {
  const html = companionTechniqueLine(get('bram'));
  assert.ok(html.includes('<strong>Shield Bash</strong>'), 'Shield Bash is bold');
  assert.ok(html.includes('<strong>Technique:</strong>'), 'label is bold');
});

test('companionTechniqueLine works without member — static per role', () => {
  // The technique line should work with just the companion def, no member needed
  const iven = get('iven');
  assert.ok(companionTechniqueLine(iven).includes('Mend'));
  // Even with an unbuilt companion-like object
  assert.ok(companionTechniqueLine({ role: 'scout' }).includes('Aimed Shot'));
});
