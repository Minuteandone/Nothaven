import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, saveGame, loadGame } from '../src/state.js';
import { applyStoryEvent, getJournal, getDialogue } from '../src/story/index.js';
import { applySupplyLineEvent, supplyLineAvailable, supplyLineReady, supplyLineRoute, getSupplyLineJournal, SUPPLY_LINE_GOLD } from '../src/story/supplyLines.js';
import { createStoryUI } from '../src/story/view.js';
import { installStory, dispatchStoryEvent } from '../src/story/integration.js';
import { installEnding } from '../src/scenes/ending.js';
import { ZONES } from '../src/map/index.js';
const report = { type: 'supply-line-report' }, accept = routeId => ({ type: 'supply-line-accept', routeId });
const flags = ['supply_patrol', 'supply_station', 'supply_relay_patrol', 'supply_junction'];
const facts = route => [
  { type: 'victory', enemyId: route === 'coastal' ? 'wrack_eel' : 'rime_wight' },
  { type: 'interact', interactionId: route === 'coastal' ? 'saltmere_harbor_lamp' : 'highwatch_cairn' },
  { type: 'victory', enemyId: 'dust_marauder' },
  { type: 'interact', interactionId: 'relay_junction' },
];
const advance = (s,e) => applyStoryEvent(s,e).state, click = arg => ({dataset:{arg}});
function ready(ending='protect_town',relay='shelter_network') {
  const s=createInitialState(); s.scene='town';
  s.story={version:1,stage:'complete',ending,flags:{road_reward:true,lens_reward:true,chapter_reward:true,rescue_reward:true,relay_reward:true,relay_choice:relay,spire_reward:true,heart_reward:true,watch_reward:true,calibration_reward:true},expedition:{active:null,completed:2}};
  s.flags.endingShown=true;s.flags.finaleShown=true;return s;
}
function freeze(v){if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v)}return v}
function bus(){const listeners=new Map();return{on(k,f){if(!listeners.has(k))listeners.set(k,new Set());listeners.get(k).add(f)},off(k,f){listeners.get(k)?.delete(f)},emit(k,v){for(const f of listeners.get(k)||[])f(v)}}}
const same = (s,e) => assert.deepEqual(applySupplyLineEvent(freeze(s),e),{state:s,rewards:[],log:[]});

test('Supply Lines strictly requires paid Calibration, not Thunderhoof, Squall or a difficulty',()=>{
 for(const value of [undefined,false,1,'true',{},[]]){
  const s=ready().story;s.flags.calibration_reward=value;
  assert.equal(supplyLineAvailable(s),false);assert.deepEqual(getSupplyLineJournal(s),[]);
  for(const e of [accept('coastal'),...facts('coastal'),report])same(s,e);
 }
 for(const s of [undefined,null,{}, {stage:'complete'}, {...ready().story,stage:'road'}]){assert.equal(supplyLineAvailable(s),false);assert.equal(supplyLineReady(s),false)}
 const s=ready().story;assert.equal(supplyLineAvailable(s),true);assert.equal(supplyLineRoute(advance(s,accept('highland'))).id,'highland');
});

test('route whitelist rejects prototype/lookalike arguments and fresh acceptance drops malformed partial progress',()=>{
 const s=ready().story;
 for(const id of ['constructor','__proto__','toString','Coastal','highlands',null,{},[]])same(s,accept(id));
 for(const id of ['constructor','__proto__','toString',1,{},[]]){
  const bad={...s,flags:{...s.flags,supply_route:id,supply_patrol:true,supply_station:true,supply_relay_patrol:true,supply_junction:true}};
  assert.equal(supplyLineRoute(bad),null);assert.equal(supplyLineReady(bad),false);same(bad,report);
  const fixed=advance(bad,accept('coastal'));assert.equal(fixed.flags.supply_route,'coastal');for(const f of flags)assert.equal(fixed.flags[f],undefined);
 }
});

for(const route of ['coastal','highland']){
 test(`${route}: old history, preaccept facts, rechoice, duplicates and out-of-order steps cannot shortcut the survey`,()=>{
  let s=ready().story;const seq=facts(route);
  for(const e of seq)same(s,e);
  s=advance(s,{...accept(route),previouslyCleared:true,previouslyInspected:true,bestiary:{wrack_eel:99,rime_wight:99,dust_marauder:99}});
  for(const f of flags)assert.equal(s.flags[f],undefined);
  same(s,accept(route==='coastal'?'highland':'coastal'));same(s,accept(route));
  for(let i=0;i<seq.length;i++){
   for(let j=0;j<seq.length;j++)if(j!==i)same(s,seq[j]);
   same(s,report);same(s,{type:'victory',encounterId:seq[i].enemyId});
   for(const bad of [null,undefined,'victory',{type:'visit',locationId:'sunscar_relay'},{type:'victory',enemyId:'constructor'},{type:'interact',interactionId:'__proto__'},facts(route==='coastal'?'highland':'coastal')[0],facts(route==='coastal'?'highland':'coastal')[1]])same(s,bad);
   const before=structuredClone(s);s=advance(freeze(s),seq[i]);assert.equal(before.flags[flags[i]],undefined);assert.equal(s.flags[flags[i]],true);
  }
  assert.equal(supplyLineReady(s),true);
  for(const e of seq)same(s,e);
  for(const f of flags)for(const value of [undefined,false,1,'true',{},[]]){
   const bad={...s,flags:{...s.flags,[f]:value}};assert.equal(supplyLineReady(bad),false);same(bad,report);
  }
  const result=applySupplyLineEvent(freeze(s),report);assert.equal(SUPPLY_LINE_GOLD,280);assert.deepEqual(result.rewards,[{id:'supply_reward',gold:280}]);assert.equal(s.flags.supply_reward,undefined);
  for(const e of [accept('coastal'),accept('highland'),...seq,report])same(result.state,e);
 });
 for(const ending of ['protect_town','share_signal'])for(const relay of ['shelter_network','route_network'])test(`${route} preserves ${ending}/${relay}, old flags and expedition state`,()=>{
  const before=freeze(ready(ending,relay).story);const paid=[accept(route),...facts(route),report].reduce(advance,before);
  assert.equal(paid.stage,before.stage);assert.equal(paid.ending,ending);assert.deepEqual(paid.expedition,before.expedition);
  for(const [k,v] of Object.entries(before.flags))assert.equal(paid.flags[k],v);
  assert.equal(getJournal(paid).find(q=>q.id==='supply_lines').status,'complete');
  assert.match(getSupplyLineJournal(paid)[0].objective,new RegExp(route==='coastal'?'harbor approach':'mountain approach'));
 });
 test(`${route} journal/dialogue/views are read-only and talking never submits a report`,()=>{
  let s=ready().story;assert.match(getSupplyLineJournal(s)[0].objective,/Earlier victories and inspections do not count/);s=advance(s,accept(route));
  const expected=route==='coastal'?['Wrack Eel','Harbor Lamp','Dust Marauder','Relay Capacitor Junction']:['Rime Wight','Highwatch Cairn','Dust Marauder','Relay Capacitor Junction'];
  for(let i=0;i<4;i++){
   const before=structuredClone(s);freeze(s);assert.match(getSupplyLineJournal(s)[0].objective,new RegExp(expected[i]));getJournal(s);
   for(const npc of ['mara','iven','tamsin','ona','rusk','constructor'])getDialogue(s,npc);
   createStoryUI().render({state:{...ready(),story:s}});assert.deepEqual(s,before);s=advance(s,facts(route)[i]);
  }
  assert.match(getSupplyLineJournal(s)[0].objective,/Conversation alone/);
  for(const npc of ['mara','iven','tamsin']){const result=applyStoryEvent(s,{type:'talk',npcId:npc});assert.deepEqual(result.rewards,[]);assert.equal(result.state.flags.supply_reward,undefined)}
 });
 test(`${route} live bus and real save/load continue the selected route and pay before observers exactly once`,()=>{
  const old=globalThis.localStorage;let raw;globalThis.localStorage={setItem:(_,v)=>raw=v,getItem:()=>raw};
  try{
   const scenes=[],paid=[],game={state:ready(),bus:bus(),setScene(id){scenes.push(id)}};const clean=installStory(game),cleanEnding=installEnding(game),before=structuredClone(game.state);
   game.bus.on('story:updated',p=>{assert.equal(p.state,game.state.story);if(p.rewards.length){paid.push(...p.rewards);assert.equal(game.state.gold,before.gold+280)}});
   const checkpoint=()=>{saveGame(game.state);game.state=loadGame()};const ui=createStoryUI();
   ui.actions.storySupplyLine(game,click(route));checkpoint();
   for(const e of facts(route)){
    if(e.type==='victory')game.bus.emit('combat:victory',{enemyId:e.enemyId,encounterId:null});else game.bus.emit('story:event',e);
    checkpoint();
   }
   ui.actions.storyTalk(game,click('mara'));assert.equal(game.state.gold,before.gold);
   ui.actions.storySupplyLine(game,click('report'));checkpoint();game.bus.emit('story:event',report);checkpoint();
   assert.deepEqual(paid,[{id:'supply_reward',gold:280}]);assert.deepEqual(scenes,[]);
   for(const k of ['party','inventory','flags','reserve'])assert.deepEqual(game.state[k],before[k]);assert.equal(game.state.story.ending,before.story.ending);
   clean();cleanEnding();const after=structuredClone(game.state);game.bus.emit('story:event',accept(route));assert.deepEqual(game.state,after);
  }finally{if(old===undefined)delete globalThis.localStorage;else globalThis.localStorage=old}
 });
}

test('shared panel validates actual location, scene, combat, availability and stale actions before touching dialogue',()=>{
 const game={state:ready(),storyDialogue:{text:'keep'}};game.state.map={zoneId:'saltmere_coast'};const ui=createStoryUI(g=>g.state.map.zoneId);
 const unchanged=arg=>{const before=structuredClone(game);ui.actions.storySupplyLine(game,click(arg));assert.deepEqual(game,before)};
 for(const arg of ['coastal','highland','report','constructor'])unchanged(arg);assert.doesNotMatch(ui.render(game),/data-action="storySupplyLine"/);
 game.state.map.zoneId='greyhaven';game.state.location='saltmere_coast';assert.match(ui.render(game),/Choose Coastal survey/);assert.match(ui.render(game),/Choose Highland survey/);
 for(const arg of ['report','constructor','__proto__',null,{}])unchanged(arg);
 for(const scene of ['combat','title','bag','quests']){game.state.scene=scene;unchanged('coastal')}game.state.scene='explore';
 game.state.combat={};unchanged('coastal');game.state.combat=null;game.state.story.flags.calibration_reward=false;unchanged('coastal');game.state.story.flags.calibration_reward=true;
 ui.actions.storySupplyLine(game,click('coastal'));assert.equal(game.storyDialogue,null);game.storyDialogue={text:'keep'};
 for(const arg of ['coastal','highland','report'])unchanged(arg);
 for(const e of facts('coastal'))dispatchStoryEvent(game,e);assert.match(ui.render(game),/data-action="storySupplyLine" data-arg="report"/);
 game.state.map.zoneId='sunscar_relay';unchanged('report');game.state.map.zoneId='greyhaven';game.state.combat={};unchanged('report');game.state.combat=null;
 ui.actions.storySupplyLine(game,click('report'));assert.equal(game.state.gold,300);assert.equal(game.storyDialogue,null);game.storyDialogue={text:'keep'};
 for(const arg of ['coastal','highland','report'])unchanged(arg);assert.doesNotMatch(ui.render(game),/data-action="storySupplyLine"/);
});

test('survey markers remain existing repeatable interactions and targets belong to the named regional patrol pools',()=>{
 for(const [zone,enemy]of [['saltmere_coast','wrack_eel'],['highwatch_pass','rime_wight'],['sunscar_relay','dust_marauder']])assert.ok(ZONES[zone].randomEncounters.some(e=>e.enemyId===enemy&&e.weight>0));
 for(const [zone,id]of [['saltmere_coast','saltmere_harbor_lamp'],['highwatch_pass','highwatch_cairn'],['sunscar_relay','relay_junction']])assert.equal(ZONES[zone].interactables.find(i=>i.id===id).once,false);
});
