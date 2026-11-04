// Companion conversation lines for the muster board. Read-only: talking never
// changes state. Lines react to the story stage, the beacon ending and rescues.

const LINES = {
  tamsin: {
    early: 'The ridge road twists like a snapped rope. Stay low on the switchbacks and the bandits never see you coming.',
    protect_town: 'A shield over Greyhaven, then. I will miss watching the light run down the coast, but the children sleep easier.',
    share_signal: 'You sent the light down every road. Out there, someone just found their way home because of you.',
    rescued: 'Both roads are open again. I counted the caravans this morning and ran out of fingers.',
  },
  iven: {
    early: 'The focusing lens bends storm light into a single beam. Without it the beacon is just a very tall lamp.',
    protect_town: 'I tuned the lens to hold the shield steady. It hums at night; I find it oddly comforting.',
    share_signal: 'Sharing the signal thins the town shield, so I check the coils every hour. Worth it, I think.',
    rescued: 'Saltmere sent spare copper wire and Highwatch sent star charts. I may never sleep again.',
  },
  bram: {
    early: 'The tide took half the pier, but it will not take the rest while I can still lift a shield.',
    protect_town: 'Strong walls keep good people safe. Saltmere will rebuild ours with stone this time.',
    share_signal: 'We saw your light from the flooded pier. That is when we knew to hold on one more night.',
    rescued: 'The harbor watch is back on the breakwater. I owe you a proper meal at the Saltmere Post.',
  },
  sela: {
    early: 'Every cairn on the pass is a promise: light it, and the next runner knows the path is safe.',
    protect_town: 'Greyhaven chose its walls. Highwatch understands; we keep a palisade of our own.',
    share_signal: 'Your beacon reached our highest cairn. I relit the whole chain by dawn just to answer it.',
    rescued: 'The pass is clear and the cairns are burning. Run with me sometime; you might keep up.',
  },
};

export function companionRemark(id, story = {}) {
  if (typeof id !== 'string' || !Object.prototype.hasOwnProperty.call(LINES, id)) return '';
  const set = LINES[id];
  if (story?.flags?.rescue_reward) return set.rescued;
  if (story?.stage === 'complete' && (story.ending === 'protect_town' || story.ending === 'share_signal')) return set[story.ending];
  return set.early;
}
