/** Optional personal requests: fixed landmarks and victories, independent of party slots. */
export const COMMISSIONS = Object.freeze([
  Object.freeze({ id: 'tamsin', name: 'Tamsin', title: 'The Scout’s Missing Route', unlock: 'victory_ridge_patrol', encounterId: 'ridge_hound_den', interactionId: 'dispatch_ridge', gold: 25,
    battle: 'Defeat the Gale Hound at the northwest den on the Ridge Road', landmark: 'recover the Ridge Road dispatch in the southeast',
    request: 'Tamsin has been retracing a relief runner’s last route. The dispatch may explain where the runner turned back; the hound den still threatens anyone sent to check.',
    aftermath: 'Tamsin spreads the recovered dispatch beside her route notes. With the den cleared, she marks that stretch for the next relief runner. “A map should tell people how to come home, too.”' }),
  Object.freeze({ id: 'iven', name: 'Iven', title: 'The Keeper’s Second Look', unlock: 'victory_observatory_sentinel', encounterId: 'observatory_construct', interactionId: 'observatory_lens_pedestal', gold: 35,
    battle: 'Defeat the Rust Sentinel in the eastern Observatory Ruins', landmark: 'inspect the Refractory Lens Pedestal in the north of the ruins',
    request: 'Iven remembers hurrying past the old calibration marks. He asks for a second inspection of the pedestal and the removal of the construct guarding the eastern work area.',
    aftermath: 'Iven copies your observations into a fresh maintenance book. “I used to think a keeper only had to keep the light burning. Someone has to record what went wrong.” The repaired beacon’s focus remains unchanged.' }),
  Object.freeze({ id: 'bram', name: 'Bram', title: 'A Lamp for the Late Boats', unlock: 'rescue_victory_coast', encounterId: 'saltmere_tide_wraith', interactionId: 'saltmere_harbor_lamp', gold: 45,
    battle: 'Defeat the Drowned Harbormaster by the western Saltmere piers', landmark: 'inspect the Saltmere Harbor Lamp on the southern shore',
    request: 'Bram worries about boats arriving after the evacuation crews have gone. He wants the old harbormaster driven from the piers and a report on the lamp they steer toward.',
    aftermath: 'Bram studies your account of the harbor lamp and sets aside a watch roster for the late boats. The harbormaster no longer haunts that berth. “A clear crossing is a start. We still have to be there when people arrive.”' }),
  Object.freeze({ id: 'sela', name: 'Sela', title: 'The Runner’s Bearings', unlock: 'rescue_victory_heights', encounterId: 'highwatch_construct', interactionId: 'highwatch_cairn', gold: 45,
    battle: 'Defeat the Rockslide Golem in northeastern Highwatch Pass', landmark: 'inspect the Highwatch Signal Cairn on the northern ridge',
    request: 'Sela can carry messages through the supply crossing again, but a golem still blocks the upper route. She asks you to clear it and check the cairn she uses to find her bearings.',
    aftermath: 'Sela redraws the upper route with the cairn as its fixed point. “When the wind takes your voice, you need something that stays.” The golem is gone; she will keep checking the trail after each storm.' }),
]);
export const getCommission = id => COMMISSIONS.find(c => c.id === id) || null;
const key = (c, fact) => `commission_${c.id}_${fact}`;
export function commissionProgress(story, id) {
  const c = getCommission(id);
  if (!c) return null;
  const f = story?.flags || {};
  const available = Boolean(f[c.unlock]);
  const accepted = Boolean(f[key(c, 'accepted')]);
  const defeated = Boolean(f[key(c, 'victory')]);
  const inspected = Boolean(f[key(c, 'inspected')]);
  const complete = Boolean(f[key(c, 'reward')]);
  return { ...c, available, accepted, defeated, inspected, complete, ready: available && accepted && defeated && inspected && !complete };
}
export function commissionObjective(story, id) {
  const c = commissionProgress(story, id);
  if (!c) return '';
  if (c.complete) return c.aftermath;
  if (!c.accepted) return `${c.request} Accept in Greyhaven; report both tasks for ${c.gold} gold. Earlier accomplishments count. No particular companion needs to be in your party.`;
  const tasks = [!c.defeated && c.battle, !c.inspected && c.landmark].filter(Boolean);
  return tasks.length ? `${tasks.join('; ')}. Then report to ${c.name} at the companion commissions board in Greyhaven for ${c.gold} gold.` : `Return to the companion commissions board in Greyhaven and report to ${c.name} for ${c.gold} gold.`;
}
export function applyCommissionEvent(previous, event) {
  const state = { ...previous, flags: { ...previous.flags } }, rewards = [], log = [];
  if (!event || typeof event !== 'object') return { state, rewards, log };
  for (const c of COMMISSIONS) {
    // Preserve early facts even before the companion or request becomes available.
    if (event.type === 'victory' && event.encounterId === c.encounterId) state.flags[key(c, 'victory')] = true;
    if (event.type === 'interact' && event.interactionId === c.interactionId) state.flags[key(c, 'inspected')] = true;
  }
  const c = commissionProgress(state, event.companionId);
  if (c?.available && event.type === 'commission-accept' && !c.accepted && !c.complete) {
    state.flags[key(c, 'accepted')] = true;
    // The town adapter supplies exact, live map history for older saves.
    if (event.previouslyCleared === true) state.flags[key(c, 'victory')] = true;
    if (event.previouslyInspected === true) state.flags[key(c, 'inspected')] = true;
    log.push(`Accepted ${c.title}. ${commissionObjective(state, c.id)}`);
  }
  if (c?.ready && event.type === 'commission-report') {
    const id = key(c, 'reward');
    state.flags[id] = true;
    rewards.push({ id, gold: c.gold });
    log.push(`${c.aftermath} Received ${c.gold} gold.`);
  }
  return { state, rewards, log };
}
export function getCommissionJournal(story) {
  return COMMISSIONS.filter(c => commissionProgress(story, c.id).accepted).map(c => ({
    id: `commission_${c.id}`, title: `${c.name}: ${c.title}`,
    status: commissionProgress(story, c.id).complete ? 'complete' : 'active', objective: commissionObjective(story, c.id),
  }));
}
