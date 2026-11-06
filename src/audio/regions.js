export const DEFAULT_SOUND_REGION = 'frontier';

// Regional variations only change the existing local synthesis graph. Unknown
// locations use the original expedition mix rather than exposing content.
export const SOUND_REGIONS = Object.freeze({
  frontier: Object.freeze({ wind: 0.065, sea: 0.034, drone: 0.007, cutoff: 840, gust: 0.085, tide: 0.72 }),
  greyhaven: Object.freeze({ wind: 0.034, sea: 0.024, drone: 0.006, cutoff: 590, gust: 0.065, tide: 0.68 }),
  ridge_road: Object.freeze({ wind: 0.074, sea: 0.018, drone: 0.008, cutoff: 930, gust: 0.11, tide: 0.62 }),
  observatory_ruins: Object.freeze({ wind: 0.047, sea: 0.016, drone: 0.013, cutoff: 710, gust: 0.052, tide: 0.58 }),
  beacon_tower: Object.freeze({ wind: 0.068, sea: 0.042, drone: 0.011, cutoff: 860, gust: 0.074, tide: 0.82 }),
  saltmere_coast: Object.freeze({ wind: 0.052, sea: 0.068, drone: 0.005, cutoff: 760, gust: 0.058, tide: 0.9 }),
  highwatch_pass: Object.freeze({ wind: 0.086, sea: 0.012, drone: 0.009, cutoff: 1120, gust: 0.13, tide: 0.52 }),
  sunscar_relay: Object.freeze({ wind: 0.043, sea: 0.009, drone: 0.015, cutoff: 640, gust: 0.045, tide: 0.48 }),
  stormcrown_spire: Object.freeze({ wind: 0.094, sea: 0.018, drone: 0.019, cutoff: 1260, gust: 0.145, tide: 0.64 }),
  storms_eye: Object.freeze({ wind: 0.105, sea: 0.038, drone: 0.024, cutoff: 1380, gust: 0.17, tide: 0.76 }),
});

export function normalizeSoundRegion(value) {
  return typeof value === 'string' && Object.hasOwn(SOUND_REGIONS, value)
    ? value
    : DEFAULT_SOUND_REGION;
}

export function getSoundRegion(value) {
  return SOUND_REGIONS[normalizeSoundRegion(value)];
}
