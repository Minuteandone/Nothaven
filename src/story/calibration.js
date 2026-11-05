export const CALIBRATION_GOLD = 220;
const STEPS = Object.freeze([
  Object.freeze({ id: 'eye_reference_gauge', flag: 'calibration_reference', objective: 'Take a fresh reference at the Eye Reference Gauge on the Storm’s Eye lower platform (3,5). Reach it through Sunscar’s northeastern switchback and the Spire summit passage. Start here; the lower stations need this reference first.', log: 'Recorded the Eye reference. Carry it down the western Summit Passage to the Eastern Barometer Logbook in Stormcrown Spire.' }),
  Object.freeze({ id: 'survey_records_b', flag: 'calibration_spire', objective: 'Leave the Eye by its western Summit Passage, then compare the fresh reference at the Eastern Barometer Logbook on Stormcrown Spire’s eastern parapet (7,3). The Sunscar junction comes next.', log: 'Compared the Spire barometer against the Eye reference. Descend to Sunscar’s Relay Capacitor Junction to synchronize the signal interval.' }),
  Object.freeze({ id: 'relay_junction', flag: 'calibration_relay', objective: 'Descend the Spire’s southwestern switchback to Sunscar Relay. Synchronize the Relay Capacitor Junction on the northern terrace (3,1), then return to Greyhaven.', log: 'Synchronized the Sunscar junction. Return to Greyhaven and explicitly report Signal Calibration for 220 gold.' }),
]);

export function calibrationAvailable(story) {
  return story?.stage === 'complete' && story.flags?.watch_reward === true;
}
export function calibrationReady(story) {
  return calibrationAvailable(story) && story.flags.calibration_accepted === true
    && STEPS.every(step => story.flags[step.flag] === true);
}
export function calibrationAftermath() {
  return 'The Eye reference, Spire barometer, and Sunscar junction now agree on one signal interval. Crews can compare warnings without changing the beacon’s reach or the relay’s chosen purpose. Ordinary weather and road threats remain.';
}

/** Fresh readings must follow the downhill sequence; map history never supplies credit. */
export function applyCalibrationEvent(previous, event) {
  const state = { ...previous, flags: { ...previous?.flags } };
  const f = state.flags, rewards = [], log = [];
  if (!event || typeof event !== 'object' || !calibrationAvailable(state) || f.calibration_reward === true) return { state, rewards, log };
  if (event.type === 'calibration-accept' && f.calibration_accepted !== true) {
    f.calibration_accepted = true;
    log.push('Mara commissions Signal Calibration: take a fresh Eye Reference Gauge reading, compare it at the Spire’s Eastern Barometer Logbook, then synchronize Sunscar’s Relay Capacitor Junction, in that order. Explicitly report in Greyhaven for 220 gold. Earlier inspections do not count.');
  }
  if (event.type === 'interact' && f.calibration_accepted === true) {
    const next = STEPS.find(step => f[step.flag] !== true);
    if (next && next.id === event.interactionId) {
      f[next.flag] = true;
      log.push(next.log);
    }
  }
  if (event.type === 'calibration-report' && calibrationReady(state)) {
    f.calibration_reward = true;
    rewards.push({ id: 'calibration_reward', gold: CALIBRATION_GOLD });
    log.push(`Received ${CALIBRATION_GOLD} gold for Signal Calibration.`, calibrationAftermath());
  }
  return { state, rewards, log };
}

export function getCalibrationJournal(story) {
  if (!calibrationAvailable(story)) return [];
  const f = story.flags;
  const objective = f.calibration_reward === true ? calibrationAftermath()
    : f.calibration_accepted !== true ? 'Optional: accept Signal Calibration in Greyhaven after reporting The Long Watch. Carry a fresh reference downhill from the Storm’s Eye through Stormcrown Spire to Sunscar Relay, then explicitly report for 220 gold. Earlier inspections do not count.'
    : calibrationReady(story) ? 'Return to Greyhaven and explicitly report Signal Calibration for 220 gold. Conversation alone does not submit the report.'
    : STEPS.find(step => f[step.flag] !== true).objective;
  return [{ id: 'signal_calibration', title: 'Signal Calibration', status: f.calibration_reward === true ? 'complete' : 'active', objective }];
}

export function getCalibrationDialogue(story, npcId) {
  if (!calibrationAvailable(story)) return null;
  if (npcId === 'mara') return { speaker: 'Warden Mara', choices: [], text: getCalibrationJournal(story)[0].objective };
  if (npcId === 'iven') return { speaker: 'Iven, Beacon Apprentice', choices: [], text: 'We are comparing the interval between signal flashes, not moving the focusing lens. It stays installed at the beacon while you carry the reference down through the stations.' };
  if (npcId === 'tamsin') return { speaker: 'Tamsin, Route Scout', choices: [], text: 'Work downhill: Eye reference, Spire barometer, Sunscar junction. Ordinary patrols remain necessary; matching the signal interval does not clear a road or change our relay’s purpose.' };
  return null;
}
