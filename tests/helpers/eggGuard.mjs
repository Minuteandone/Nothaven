// Shared Easter-egg guard for content tests.
// Import EGG_RE / findEggWords instead of copying a local regex, so every
// guard grows together when a new egg-adjacent word is added here.

export const EGG_WORDS = [
  'eggs?', 'eggshells?', 'yolks?', 'shells?', 'hatch\\w*', 'nests?', 'nest(?:ed|ing)', 'chicks?', 'chickens?',
  'hens?', 'roosters?', 'cockerels?', 'pullets?', 'broody', 'omelet\\w*', 'scrambl\\w*', 'humpty', 'dumpty',
  'benedict', 'faberg\\w*', 'clutch\\w*', 'incubat\\w*', 'ovum', 'ova', 'oeufs?', 'huevos?', 'quails?',
  'poach\\w*', 'fried', 'devil(?:l)?ed', 'albumen', 'easter', 'goose', 'geese', 'gosling\\w*', 'ovals?',
  'ovoid\\w*', 'sunny', 'over-easy', 'boil\\w*', 'crack\\w*', 'whisk\\w*', 'cackl\\w*', 'cluck\\w*', 'pearl',
  'golden', 'basket', 'peeps?', 'quiche', 'meringue', 'custard', 'frittata', 'souffl\\w*', 'mayonnaise',
];

export const EGG_RE = new RegExp(`\\b(?:${EGG_WORDS.join('|')})\\b|🥚|🐣|🐤|🐥|🍳|🐔|🪺|🪹`, 'i');

const EGG_RE_GLOBAL = new RegExp(EGG_RE.source, 'gi');

/**
 * Return every egg-adjacent match in `text`, skipping any whose surrounding
 * line matches one of the `allow` regexes (for vetted, benign wording).
 */
export function findEggWords(text, allow = []) {
  const hits = [];
  String(text).split('\n').forEach((line, i) => {
    if (allow.some((re) => re.test(line))) return;
    for (const m of line.matchAll(EGG_RE_GLOBAL)) hits.push(`${i + 1}: ${m[0]} :: ${line.trim().slice(0, 100)}`);
  });
  return hits;
}
