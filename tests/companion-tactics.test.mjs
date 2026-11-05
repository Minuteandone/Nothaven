import test from 'node:test';
import assert from 'node:assert/strict';
import { companionTactic, setCompanionTactic } from '../src/party/tactics.js';
import { createCompanionMember, recruitCompanion, dismissCompanion } from '../src/party/companions.js';
import { createInitialState } from '../src/state.js';
import { createCombat, companionTurn, heroStats } from '../src/combat/rules.js';
import { combatScene } from '../src/scenes/combat.js';
import { renderCombat } from '../src/ui/combat.js';
import { combatShortcutTarget } from '../src/ui/combatControls.js';
import { migrateSave } from '../src/core/save.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

const act = (g, action, arg) => combatScene.actions[action](g, {dataset:{arg}});
function fixture() {
  const state = createInitialState();
  state.party.push(createCompanionMember('iven'), createCompanionMember('sela'));
  state.combat = createCombat({enemyId:'storm_heart'});
  let calls = 0;
  return {state, combatMenu:'tactics', combatRng:()=>{calls++;return .5;}, calls:()=>calls};
}

test('only the exact conserve preference changes automatic defaults', () => {
  for (const member of [undefined,null,{}, {tactic:'auto'}, {tactic:true}, {tactic:'Conserve'}, {tactic:{}}, {tactic:'constructor'}]) assert.equal(companionTactic(member),'auto');
  assert.equal(companionTactic({tactic:'conserve'}),'conserve');
  const s=createInitialState(); const before=structuredClone(s);
  for(const id of ['hero','iven','constructor','__proto__',undefined]) assert.equal(setCompanionTactic(s,id,'conserve'),false);
  assert.deepEqual(s,before);
});

for(const level of [1,8]) {
  for(const technique of ['mend','spark','flare']) test(`${technique} at level ${level}: conserve attacks without spending MP, automatic retains paid technique`,()=>{
    for(const tactic of ['auto','conserve']) {
      const hero=createInitialState().party[0];
      const m=createCompanionMember(technique==='flare'?'sela':'iven',level); m.tactic=tactic;
      if(technique==='mend')hero.hp=1;
      const c=createCombat({enemyId:technique==='spark'?'rust_sentinel':'storm_heart'});
      const before={mp:m.mp,hp:hero.hp,enemy:c.enemy.hp};
      const lines=companionTurn(c,m,[hero,m],()=>.5).join(' ');
      if(tactic==='conserve') {
        assert.equal(m.mp,before.mp);assert.equal(hero.hp,before.hp);
        assert.match(lines,/strikes for/);assert.ok(c.enemy.hp<before.enemy);
      } else {
        assert.equal(m.mp,before.mp-(technique==='flare'?3:4));
        if(technique==='mend') {
          const heal=(10+level*2)*(level>=8?1.5:1);
          assert.equal(hero.hp,Math.min(heroStats(hero).maxHp,1+Math.floor(heal)));
          assert.equal(c.enemy.hp,before.enemy);assert.match(lines,/Mend/);
        } else {assert.match(lines,technique==='spark'?/Spark/:/Flare/);assert.ok(c.enemy.hp<before.enemy);}
      }
    }
  });
}

test('shock still blocks paid techniques and free techniques retain exact behavior',()=>{
  for(const id of ['iven','sela'])for(const tactic of ['auto','conserve']) {
    const m=createCompanionMember(id,8);m.tactic=tactic;m.statuses=['shocked'];
    const c=createCombat({enemyId:'rust_sentinel'}), mp=m.mp;
    assert.match(companionTurn(c,m,[m],()=>.5).join(' '),/strikes for/);assert.equal(m.mp,mp);
  }
  for(const id of ['tamsin','bram'])for(const level of [1,8]) {
    const m=createCompanionMember(id,level), n=structuredClone(m);n.tactic='conserve';
    const c=createCombat({enemyId:'rust_sentinel'}),d=structuredClone(c);
    assert.deepEqual(companionTurn(c,m,[m],()=>.1),companionTurn(d,n,[n],()=>.1));
    assert.deepEqual(c,d);delete n.tactic;assert.deepEqual(m,n);
  }
});

test('downed companions and resolved combat remain inactive',()=>{
  for(const over of [null,'victory']) {
    const m=createCompanionMember('sela');m.tactic='conserve';if(!over)m.hp=0;
    const c=createCombat({enemyId:'rat'});c.over=over;const before=structuredClone({m,c});
    assert.deepEqual(companionTurn(c,m,[m],()=>{throw Error('unexpected RNG');}),[]);
    assert.deepEqual({m,c},before);
  }
});

test('tactic selection changes only the chosen preference, with no turn or RNG',()=>{
  const g=fixture(), before=structuredClone(g.state);
  act(g,'setTactic','sela:conserve');
  const expected=structuredClone(before);expected.party[2].tactic='conserve';
  assert.deepEqual(g.state,expected);assert.equal(g.calls(),0);
  act(g,'menu','main');assert.deepEqual(g.state,expected);
  act(g,'menu','tactics');act(g,'setTactic','sela:auto');expected.party[2].tactic='auto';
  assert.deepEqual(g.state,expected);assert.equal(g.calls(),0);
});

test('invalid, stale, downed and hero tactic actions are atomic no-ops',()=>{
  const g=fixture(), before=structuredClone(g.state);
  for(const arg of [undefined,null,1,'','sela','sela:CONSERVE','sela:conserve:extra',' sela:conserve','sela:conserve\n','hero:conserve','bram:conserve','constructor:auto','__proto__:auto','1:conserve'])act(g,'setTactic',arg);
  assert.deepEqual(g.state,before);
  for(const setup of [()=>{g.combatMenu='main';},()=>{g.combatMenu='tactics';g.state.party[2].hp=0;},()=>{g.state.party[2].hp=5;g.state.combat.over='victory';},()=>{g.state.combat=null;}]) {
    setup();const s=structuredClone(g.state);act(g,'setTactic','sela:conserve');assert.deepEqual(g.state,s);
  }
  assert.equal(g.calls(),0);
});

test('rendering is escaped and read-only with pressed native buttons, downed disabled and no digit choices',()=>{
  const g=fixture();g.state.party[1].name='<Iven & "keeper">';g.state.party[2].tactic='conserve';g.state.party[2].hp=0;
  const before=structuredClone(g.state);
  const html=renderCombat({...g.state,menu:'tactics'});
  assert.match(html,/&lt;Iven &amp; &quot;keeper&quot;&gt;/);
  assert.match(html,/data-arg="iven:auto" aria-pressed="true"/);
  assert.match(html,/data-arg="sela:conserve" aria-pressed="true" disabled/);
  assert.equal((html.match(/data-action="setTactic"/g)||[]).length,4);
  assert.doesNotMatch(html,/class="command-card"/);
  assert.match(html,/Changes cost no turn/);assertEggFree(html);assert.deepEqual(g.state,before);
  const solo=renderCombat({combat:g.state.combat,party:[g.state.party[0]]});
  assert.match(solo,/<button[^>]*data-arg="tactics"[^>]*disabled/);
});

test('T uses native enabled buttons, respects opt-out and Escape, and never adds digit choices',()=>{
  const button=(action,arg,disabled=false)=>({dataset:{action,arg},disabled,click(){},classList:{contains:()=>false}});
  const tactic=button('menu','tactics'),back=button('menu','main'),set=button('setTactic','sela:conserve');
  let off=false;
  const root={ownerDocument:{querySelector:()=>null,documentElement:{getAttribute:()=>off?'off':'on'}},querySelectorAll:()=>[tactic,back,set]};
  assert.equal(combatShortcutTarget(root,{code:'KeyT'}),tactic);
  assert.equal(combatShortcutTarget(root,{key:'t'}),tactic);
  for(const event of [{code:'Digit1'},{code:'Numpad1'},{code:'KeyT',repeat:true},{code:'KeyT',ctrlKey:true},{code:'KeyT',target:{tagName:'INPUT'}}])assert.equal(combatShortcutTarget(root,event),null);
  tactic.disabled=true;assert.equal(combatShortcutTarget(root,{code:'KeyT'}),null);tactic.disabled=false;
  off=true;assert.equal(combatShortcutTarget(root,{code:'KeyT'}),null);assert.equal(combatShortcutTarget(root,{code:'Escape'}),back);
});

test('manual save migration and reserve round trip preserve chosen tactics without changing old saves',()=>{
  const s=createInitialState();s.story.flags.victory_observatory_sentinel=true;
  recruitCompanion(s,'iven');assert.equal('tactic' in s.party[1],false);
  assert.equal(setCompanionTactic(s,'iven','conserve'),true);
  assert.equal(dismissCompanion(s,'iven').ok,true);
  const loaded=migrateSave(JSON.parse(JSON.stringify(s)),createInitialState);
  assert.equal(loaded.reserve.iven.tactic,'conserve');
  assert.equal(recruitCompanion(loaded,'iven').ok,true);assert.equal(loaded.party[1].tactic,'conserve');
  const old=migrateSave(createInitialState(),createInitialState);assert.equal('tactic' in old.party[0],false);
});
