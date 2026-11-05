// Warden Mara's tactical advice for each foe, shown in the Field Journal once defeated.
export const FIELD_TIPS = {
  storm_rat: 'Small and quick to bite. Keep a bandage ready for the bleeding and simply out-hit it.',
  ridge_bandit: 'Its Dirty Cut opens wounds. Strike first and mend once the fight is over.',
  gale_hound: 'Faster than most of the patrol, so expect it to act first. Defending blunts the lunge.',
  rust_sentinel: 'An old construct: Spark ignores its plating and hits harder against machinery.',
  tide_wraith: 'It drags the shocked into the undertow. Save MP for Mend before it grows enraged at low health.',
  reef_crawler: 'Thick carapace and a bleeding grip. Power Strike punches through better than plain attacks.',
  squall_revenant: 'Its rain leaves the party shocked. Bring tonics; Steady Signal clears the static once learned.',
  briar_boar: 'Slow but heavy. Defend when it lowers its tusks, then strike back while it recovers.',
  old_tusk: 'An optional ridge trial. Bramble Charge leaves deep bleeding: carry bandages or Rallying Light, and Defend when he enrages at half health.',
  lens_wisp: 'Fragile and quick. Its glare leaves the party shocked, so finish it fast with plain attacks.',
  gloomfin: 'An optional coast trial. Riptide Shock blocks most skills: pack storm tonics, keep Steady Signal or Burst ready, and Defend once it enrages at half health.',
  wrack_eel: 'Its bite causes bleeding. Keep bandages handy and heal before the damage stacks up.',
  rime_wight: 'Its frost leaves the party shocked. Spark and tonics both help; Steady Signal clears the chill.',
  lenswarden: 'An optional observatory trial. It is a construct, so Spark and Signal Flare hit hard; its Focused Beam leaves you shocked, so carry storm tonics or Steady Signal, and Defend once it enrages at half health.',
  thunderhoof: 'An optional ridge trial after Signal Calibration. Arcing Antlers leaves you shocked, so keep a cleanse or Stormhaven Vigil ready, and Defend when it gathers a Stampede Rush. Bring level 14 or better and a full party.',
  cinderclaw: 'An optional plateau trial after the Spire. Its Searing Sting opens bleeding wounds and it can clamp down with Pincer Vise: Defend when it starts gathering, carry bandages or field dressings, and save your burst for its enraged second half.',
  frostmane: 'An optional heights trial. It is quick and its Rime Fang opens bleeding wounds: carry bandages or field dressings, keep Rallying Light ready, and Defend once it enrages at half health.',
  frost_wolf: 'The fastest beast on the heights. Bleeding stacks up quickly, so heal early rather than late.',
  rockslide_golem: 'Slow but heavily armored. Spark and Iven’s sparks work well on constructs.',
  pass_warlord: 'The halberd sweep causes bleeding. Rallying Light keeps the whole party standing.',
  drowned_harbormaster: 'The anchor chain shocks. Keep your strongest skills ready for its second phase.',
  dust_marauder: 'Sandblind Slash bleeds deep. Fight in short, sharp bursts and do not linger in the dunes.',
  relay_drone: 'A construct that shocks on contact. Clear the static fast and answer with Spark.',
  relay_warden: 'A towering construct boss. Its beam shocks, and it hits harder below half health. Warding Stance buys time.',
  ashen_raider: 'Hits hard and leaves burning wounds. Good armor and a ready cleanse keep raids short.',
  spire_sentry: 'Chain Lightning shocks the party. Beacon Lance pierces its plating even while shocked.',
  stormcrown_tyrant: 'The storm’s master. Raise Beacon Aegis before it enrages, and keep a cleanse for its Tempest Call.',
  tempest_shade: 'Fast and slippery. Its Static Lash shocks one ally, so keep Steady Signal ready and strike with Beacon Lance.',
  thunderhead_colossus: 'Slow but heavily plated. Spark and Beacon Lance cut through its storm-iron; Warding Stance blunts its Thunderclap.',
  storm_heart: 'The source of the storm itself. Open with Beacon Aegis, cleanse shocks quickly, and save tonics for when it spins faster.',
  last_squall: 'An optional trial far beyond the Heart. Come at level 15 or higher with your best gear, keep Beacon Aegis up, and hold a Beacon Burst for when it draws in every storm.',
};

export function fieldTip(enemyId) {
  return Object.prototype.hasOwnProperty.call(FIELD_TIPS, enemyId) ? FIELD_TIPS[enemyId] : '';
}
