export const WATCH_GOLD = 180;
const READINGS = Object.freeze([
  Object.freeze({ id: 'saltmere_harbor_lamp', flag: 'watch_coast', name: 'Saltmere Harbor Lamp (south from Greyhaven, pier’s southern end)' }),
  Object.freeze({ id: 'highwatch_cairn', flag: 'watch_heights', name: 'Highwatch Signal Cairn (Ridge Road’s north trail, northern overlook)' }),
  Object.freeze({ id: 'observatory_forecast_stand', flag: 'watch_observatory', name: 'Observatory Forecast Stand (Ridge Road’s north ascent, beside the old lens pedestal)' }),
]);

export function watchAvailable(story) {
  return story?.stage === 'complete' && story.flags?.heart_reward === true;
}
export function watchReady(story) {
  return watchAvailable(story) && story.flags.watch_accepted === true
    && READINGS.every(reading => story.flags[reading.flag] === true);
}
export function watchAftermath() {
  return 'Saltmere’s harbor readings, Highwatch’s wind records, and the observatory’s measurements now share one timetable. Forecasts guide the next watch; ordinary storms and road threats remain.';
}

/** Only fresh inspections after explicit acceptance count. No map-history credit. */
export function applyWatchEvent(previous, event) {
  const state = { ...previous, flags: { ...previous?.flags } };
  const f = state.flags, rewards = [], log = [];
  if (!event || typeof event !== 'object' || !watchAvailable(state) || f.watch_reward === true) return { state, rewards, log };
  if (event.type === 'watch-accept' && f.watch_accepted !== true) {
    f.watch_accepted = true;
    log.push('Mara commissions The Long Watch. Take fresh readings at Saltmere’s harbor lamp, Highwatch’s signal cairn, and the Observatory Forecast Stand, then explicitly report in Greyhaven for 180 gold. Old inspections do not count.');
  }
  if (event.type === 'interact' && f.watch_accepted === true) {
    const reading = READINGS.find(reading => reading.id === event.interactionId);
    if (reading && f[reading.flag] !== true) {
      f[reading.flag] = true;
      log.push(`Recorded a fresh reading: ${reading.name}.`);
    }
  }
  if (event.type === 'watch-report' && watchReady(state)) {
    f.watch_reward = true;
    rewards.push({ id: 'watch_reward', gold: WATCH_GOLD });
    log.push(`Received ${WATCH_GOLD} gold for The Long Watch.`, watchAftermath());
  }
  return { state, rewards, log };
}

export function getWatchJournal(story) {
  if (!watchAvailable(story)) return [];
  const f = story.flags;
  const objective = f.watch_reward === true ? watchAftermath()
    : f.watch_accepted !== true ? 'Optional: accept Mara’s clear-weather survey in Greyhaven for 180 gold. This is separate from the Last Squall. Take fresh readings after accepting; old inspections do not count.'
    : watchReady(story) ? `Return to Greyhaven and explicitly report the three readings to Mara for ${WATCH_GOLD} gold. Conversation alone does not submit the report.`
    : `Take fresh readings after accepting: ${READINGS.filter(reading => f[reading.flag] !== true).map(reading => reading.name).join('; ')}. Then report in Greyhaven.`;
  return [{ id: 'long_watch', title: 'The Long Watch', status: f.watch_reward === true ? 'complete' : 'active', objective }];
}

export function getWatchDialogue(story, npcId) {
  if (!watchAvailable(story)) return null;
  const f = story.flags;
  if (npcId === 'mara') return { speaker: 'Warden Mara', choices: [], text: f.watch_reward === true ? watchAftermath()
    : f.watch_accepted !== true ? 'The great storm over Stormcrown has broken. Ordinary weather and fixed foes remain. Help us rebuild a shared timetable: the council offers 180 gold for fresh readings at Saltmere’s harbor lamp, Highwatch’s signal cairn, and the Observatory Forecast Stand. Accept The Long Watch here if you wish; the Last Squall is a separate challenge.'
    : watchReady(story) ? 'The three readings are ready. Explicitly submit your survey report here so the council can pay your company and send the timetable to both settlements.'
    : 'Take fresh readings at all three stations after accepting the survey. Old inspections do not count; bring the measurements back to Greyhaven when you are ready.' };
  if (npcId === 'iven') return { speaker: 'Iven, Beacon Apprentice', choices: [], text: 'The forecast stand measures ordinary weather without the recovered lens. Its sighting rule can compare the harbor lamps and northern cairns while the lens stays at the beacon.' };
  if (npcId === 'tamsin') return { speaker: 'Tamsin, Route Scout', choices: [], text: 'Saltmere, Highwatch, and the observatory still need patrols. A shared timetable helps us plan the watch; it does not drive every threat off those roads.' };
  return null;
}
