import test from 'node:test';
import assert from 'node:assert/strict';
import {recipeBookEntries,filterRecipeEntries,recipesScene} from '../src/scenes/recipes.js';
import {createInitialState} from '../src/state.js';
import {assertEggFree} from './helpers/eggGuard.mjs';
const inventory=[{id:'healing_herb',qty:2},{id:'storm_glass',qty:1}];
const ids=entries=>entries.map(e=>e.recipe.id);
function game(){return {state:{...createInitialState(),scene:'recipes',inventory:structuredClone(inventory)},recipesFilter:'all',recipesQuery:'',root:{querySelector:()=>({value:'  STORM TONIC  '})},setScene(name,data){this.lastScene={name,data}}};}

test('availability filters preserve catalogue order, identities, and whole inputs',()=>{
 const entries=recipeBookEntries(inventory),before=structuredClone(entries),original=structuredClone(inventory);
 assert.deepEqual(filterRecipeEntries(entries),entries);
 assert.deepEqual(ids(filterRecipeEntries(entries,'ready')),['distill_tonic']);
 assert.deepEqual(ids(filterRecipeEntries(entries,'missing')),ids(entries).filter(id=>id!=='distill_tonic'));
 assert.equal(filterRecipeEntries(entries,'ready')[0],entries.find(e=>e.recipe.id==='distill_tonic'));
 assert.deepEqual(entries,before);assert.deepEqual(inventory,original);
});
test('search matches recipe, ingredient, and output names, not internal IDs or description',()=>{
 const entries=recipeBookEntries(inventory);
 assert.deepEqual(ids(filterRecipeEntries(entries,'all','  DISTILL STORM  ')),['distill_tonic']);
 assert.deepEqual(ids(filterRecipeEntries(entries,'all','Healing Herb')),['distill_tonic','brew_chowder']);
 assert.deepEqual(ids(filterRecipeEntries(entries,'all','Storm Tonic')),['distill_tonic','mull_highland_flask']);
 assert.deepEqual(ids(filterRecipeEntries(entries,'ready','Storm Tonic')),['distill_tonic']);
 assert.deepEqual(ids(filterRecipeEntries(entries,'missing','Storm Tonic')),['mull_highland_flask']);
 assert.deepEqual(filterRecipeEntries(entries,'all','distill_tonic'),[]);
 assert.deepEqual(filterRecipeEntries(entries,'all','sparking draught'),[]);
});
test('invalid filter falls back to all, nonstring query is empty, and query length is bounded',()=>{
 const entries=recipeBookEntries(inventory);
 for(const filter of ['constructor','READY',null,{},['ready']])assert.deepEqual(filterRecipeEntries(entries,filter),entries);
 for(const query of [null,{},[],42])assert.deepEqual(filterRecipeEntries(entries,'all',query),entries);
 const long=[{ready:true,recipe:{name:'a'.repeat(120),inputs:[],outputs:[]}}];
 assert.deepEqual(filterRecipeEntries(long,'all','a'.repeat(120)+'NO'),long);
});
test('render is read-only with one pressed filter, count, empty message, and escaped query',()=>{
 const g=game();g.recipesFilter='ready';const before=structuredClone(g.state);let html=recipesScene.render(g);
 assert.equal((html.match(/aria-pressed="true"/g)||[]).length,1);assert.match(html,/data-arg="ready" aria-pressed="true"/);
 assert.match(html,/Showing 1 of 26 recipes\./);assertEggFree(html,'recipe planning');
 g.recipesQuery='"><img src=x onerror=alert(1)>';
 html=recipesScene.render(g);assert.match(html,/&quot;&gt;&lt;img/);assert.doesNotMatch(html,/<img/);
 assert.match(html,/No recipes match these choices\./);assert.match(html,/Showing 0 of 26 recipes\./);
 assert.deepEqual(g.state,before);
});
test('planning actions normalize query and alter only transient settings; clear preserves filter',()=>{
 const g=game(),before=structuredClone(g.state);
 recipesScene.actions.recipeFilter(g,{dataset:{arg:'ready'}});recipesScene.actions.searchRecipes(g);
 assert.equal(g.recipesQuery,'STORM TONIC');assert.equal(g.recipesFilter,'ready');
 recipesScene.actions.clearRecipeSearch(g);assert.equal(g.recipesQuery,'');assert.equal(g.recipesFilter,'ready');
 g.root.querySelector=()=>({value:' z'.repeat(200)});recipesScene.actions.searchRecipes(g);assert.equal(g.recipesQuery.length,120);
 assert.deepEqual(g.state,before);
});
test('invalid/stale planning controls cannot change state or transient settings',()=>{
 for(const mode of ['town','combat']){
  const g=game();if(mode==='town')g.state.scene='town';else g.state.combat={};
  const before=structuredClone(g.state);g.recipesFilter='missing';g.recipesQuery='kept';
  recipesScene.actions.recipeFilter(g,{dataset:{arg:'ready'}});recipesScene.actions.searchRecipes(g);recipesScene.actions.clearRecipeSearch(g);
  assert.equal(g.recipesFilter,'missing');assert.equal(g.recipesQuery,'kept');assert.deepEqual(g.state,before);
 }
 const g=game();for(const arg of [undefined,null,{},['ready'],'constructor','READY'])recipesScene.actions.recipeFilter(g,{dataset:{arg}});
 assert.equal(g.recipesFilter,'all');g.recipesQuery='kept';
 for(const value of [null,undefined,{},['new']]){g.root.querySelector=()=>({value});recipesScene.actions.searchRecipes(g);assert.equal(g.recipesQuery,'kept');}
 delete g.root;recipesScene.actions.searchRecipes(g);assert.equal(g.recipesQuery,'kept');
});
test('reopening resets view choices and Back preserves Bag exploration return',()=>{
 const g=game(),before=structuredClone(g.state);g.recipesFilter='missing';g.recipesQuery='iron';g.bagReturnScene='explore';
 recipesScene.onEnter(g,{returnScene:'bag'});assert.equal(g.recipesFilter,'all');assert.equal(g.recipesQuery,'');
 recipesScene.actions.leave(g);assert.deepEqual(g.lastScene,{name:'bag',data:{returnScene:'explore'}});assert.deepEqual(g.state,before);
});
