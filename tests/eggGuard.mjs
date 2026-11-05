// Shared anti-easter-egg guard for the Beacon of Stormhaven test suite.
//
// Rule of the project: shipped prose, labels, names, descriptions and
// comments must never use the Day-1 "easter egg" vocabulary. Content-bearing
// test files should import this module instead of redefining their own regex,
// so the vocabulary stays canonical and a hand-rolled local copy can never
// silently weaken a guard (e.g. substring matching that lets "henhouse" slip
// past a check for "hen ").
//
// This file itself necessarily contains egg words inside the regex source;
// egg-audit greps over tests/ should treat eggGuard.mjs as expected noise.

/** Canonical egg-vocabulary matcher: word-bounded, case-insensitive. */
export const EGG_RE = /\b(eggs?|yolks?|shells?|shell(ed|ing)?|hatch\w*|nests?|nest(ed|ing)?|chicks?|chickens?|roosters?|hens?|hen|easter|scrambl\w*|omelet\w*|peeps?|peeping|albumen|ovoid|oval|quiche|meringue|custard|poach\w*|frittata|boil\w*|crack\w*|whisk\w*|cackl\w*|pearl|golden|basket|quail|goose|sunny|fried|devil\w*|clutch|incubat\w*|humpty|benedict|faberg\w*|ovum|oeuf|huevo)\b/i;

/**
 * Compound-smuggling watchlist: catches egg/yolk fused into larger words
 * ("eggshell", "eggcup", "yolkish", "yolked") where the word-bounded EGG_RE
 * cannot fire. Egg and yolk have almost no innocent compounds in English, so
 * this stays low-false-positive; words like "flagged" or "jagged" do not
 * contain the 'egg' letter-pair.
 */
export const EGG_COMPOUND_RE = /\b(?:egg|yolk)[a-z]+\b|\b[a-z]+(?:egg|yolk)\b/i;

/**
 * Strip HTML attribute values (class="game-shell" etc.) so benign identifiers
 * never mask real prose violations, then return every egg-word hit.
 */
export function eggHits(text) {
  const stripped = String(text).replace(/\s[a-z-]+=(?:"[^"]*"|'[^']*')/g, '');
  const union = new RegExp(`${EGG_COMPOUND_RE.source}|${EGG_RE.source}`, 'gi');
  return [...stripped.matchAll(union)].map((m) => m[0]);
}

/** Assert a surface is egg-free; `label` names it in the failure message. */
export function assertEggFree(text, label) {
  const hits = eggHits(text);
  if (hits.length > 0) {
    throw new Error(`${label}: egg vocabulary found -> ${hits.join(', ')}`);
  }
  return hits;
}
