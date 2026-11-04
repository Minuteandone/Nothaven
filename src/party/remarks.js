// Companion conversation lines for the muster board. Read-only: talking never
// changes state. Lines react to the story stage, the beacon ending, rescues and
// the chapter-three relay choice.

const LINES = {
  tamsin: {
    shelter_network: 'Sheltered waystations every half day of walking. My feet thank you; my scouting pride is wounded.',
    route_network: 'With the relay calling the patrols, half the dust raiders turn back before we even reach them. Boring roads are good roads.',
    early: 'The ridge road twists like a snapped rope. Stay low on the switchbacks and the bandits never see you coming.',
    protect_town: 'A shield over Greyhaven, then. I will miss watching the light run down the coast, but the children sleep easier.',
    share_signal: 'You sent the light down every road. Out there, someone just found their way home because of you.',
    rescued: 'Both roads are open again. I counted the caravans this morning and ran out of fingers.',
  },
  iven: {
    shelter_network: 'The relay feeds warmth to every waystation now. I added a little dial to each one. Nobody asked, but they all use it.',
    route_network: 'Routing the network means every signal tower talks to every other. I spent all night listening to them chatter.',
    early: 'The focusing lens bends storm light into a single beam. Without it the beacon is just a very tall lamp.',
    protect_town: 'I tuned the lens to hold the shield steady. It hums at night; I find it oddly comforting.',
    share_signal: 'Sharing the signal thins the town shield, so I check the coils every hour. Worth it, I think.',
    rescued: 'Saltmere sent spare copper wire and Highwatch sent star charts. I may never sleep again.',
  },
  bram: {
    shelter_network: 'Saltmere runners rest at the waystations now. A roof and a fire for two coins is a fair trade on a long road.',
    route_network: 'The relay clears the roads before the caravans set out. Fewer fights, more cargo. Saltmere approves.',
    early: 'The tide took half the pier, but it will not take the rest while I can still lift a shield.',
    protect_town: 'Strong walls keep good people safe. Saltmere will rebuild ours with stone this time.',
    share_signal: 'We saw your light from the flooded pier. That is when we knew to hold on one more night.',
    rescued: 'The harbor watch is back on the breakwater. I owe you a proper meal at the Saltmere Post.',
  },
  sela: {
    shelter_network: 'The cairn runners sleep in the relay shelters between legs. I have never seen them so rested, or so smug.',
    route_network: 'Signals race from the pass to the coast faster than I can run. I am not jealous. Much.',
    early: 'Every cairn on the pass is a promise: light it, and the next runner knows the path is safe.',
    protect_town: 'Greyhaven chose its walls. Highwatch understands; we keep a palisade of our own.',
    share_signal: 'Your beacon reached our highest cairn. I relit the whole chain by dawn just to answer it.',
    rescued: 'The pass is clear and the cairns are burning. Run with me sometime; you might keep up.',
  },
};

export function companionRemark(id, story = {}) {
  if (typeof id !== 'string' || !Object.prototype.hasOwnProperty.call(LINES, id)) return '';
  const set = LINES[id];
  const relay = story?.flags?.relay_choice;
  if ((relay === 'shelter_network' || relay === 'route_network') && set[relay]) return set[relay];
  if (story?.flags?.rescue_reward) return set.rescued;
  if (story?.stage === 'complete' && (story.ending === 'protect_town' || story.ending === 'share_signal')) return set[story.ending];
  return set.early;
}
