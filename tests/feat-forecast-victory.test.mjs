import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState } from "../src/state.js";
import { createCombat } from "../src/combat/rules.js";
import { combatScene } from "../src/scenes/combat.js";
import { installBestiary } from "../src/scenes/bestiary.js";
import { installProgression } from "../src/core/progression.js";
import { featCombatText, featStatus } from "../src/scenes/feats.js";
import { featReachNote } from "../src/ui/combat.js";

const bookOf = (ids) => Object.fromEntries(ids.map((id) => [id, 1]));
const OTHER_FOES = [
  "storm_rat",
  "ridge_bandit",
  "gale_hound",
  "rust_sentinel",
  "briar_boar",
  "lens_wisp",
];

function harness(enemyId, book = {}, drill = false) {
  const state = createInitialState();
  // Synthetic overpowering stats isolate victory wiring; not earned play or balance evidence.
  Object.assign(state.party[0], {
    level: 20,
    xp: 2850,
    hp: 100000,
    maxHp: 100000,
    mp: 100,
    maxMp: 100,
    atk: 100000,
    def: 10000,
    spd: 10000,
  });
  state.bestiary = structuredClone(book);
  state.scene = "combat";
  state.combat = createCombat({ enemyId });
  state.combat.drill = drill;
  const listeners = new Map();
  const events = [];
  const game = {
    state,
    combatRng: () => 0.5,
    registerScene() {},
    bus: {
      on(name, fn) {
        if (!listeners.has(name)) listeners.set(name, new Set());
        listeners.get(name).add(fn);
      },
      off(name, fn) {
        listeners.get(name)?.delete(fn);
      },
      emit(name, value) {
        events.push(name);
        for (const fn of listeners.get(name) || []) fn(value);
      },
    },
  };
  installBestiary(game);
  installProgression(game);
  return { game, events };
}

function freeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(freeze);
  }
  return value;
}

function assertForecast(game, text) {
  const before = structuredClone(game.state);
  const savedRandom = Math.random;
  const savedCombatRng = game.combatRng;
  try {
    Math.random = game.combatRng = () => {
      throw new Error("Forecast consumed RNG");
    };
    assert.equal(featCombatText(game.state, game.state.combat), text);
    const html = combatScene.render(game);
    assert.equal(
      (html.match(/class="feat-reach-note"/g) || []).length,
      text ? 1 : 0,
    );
    if (text)
      assert.ok(
        html.includes(
          `<span class="feat-reach-note__label">Feat in reach:</span> ${text}</p>`,
        ),
      );
    assert.deepEqual(
      game.state,
      before,
      "reading the full scene preserves the entire state",
    );
  } finally {
    Math.random = savedRandom;
    game.combatRng = savedCombatRng;
  }
}

function winAndCheck(game, events, expectedIds) {
  const state = game.state;
  const before = structuredClone(state);
  const had = new Set(
    featStatus(state)
      .filter((f) => f.done)
      .map((f) => f.id),
  );
  combatScene.actions.attack(game);
  assert.equal(state.combat.over, "victory");
  const id = state.combat.enemy.id;
  assert.deepEqual(state.bestiary, {
    ...before.bestiary,
    [id]: (before.bestiary[id] || 0) + 1,
  });
  assert.deepEqual(
    featStatus(state)
      .filter((f) => f.done && !had.has(f.id))
      .map((f) => f.id),
    expectedIds,
  );
  assert.equal(state.gold, before.gold + state.combat.rewards.gold);
  assert.equal(state.party[0].xp, before.party[0].xp + state.combat.rewards.xp);
  assert.equal(events.filter((name) => name === "combat:victory").length, 1);
  assert.ok(!combatScene.render(game).includes('class="feat-reach-note"'));
  const paid = structuredClone(state);
  const eventCount = events.length;
  combatScene.actions.attack(game);
  paid.combat.log.push("The battle is over.");
  assert.deepEqual(
    state,
    paid,
    "duplicate Attack only logs the terminal message; no second payment or record",
  );
  assert.equal(events.length, eventCount);
}

test("literal one-, two- and three-feat forecasts agree with real victory listeners", () => {
  const cases = [
    ["old_tusk", {}, "Winning this battle earns “Tusk Breaker”.", ["tusk"]],
    [
      "old_tusk",
      bookOf(["gloomfin", "frostmane", "lenswarden", ...OTHER_FOES]),
      "Winning this battle earns “Field Researcher”, “Tusk Breaker” and “Trial Warden”.",
      ["catalogue", "tusk", "trials"],
    ],
    [
      "rime_wight",
      bookOf([
        "briar_boar",
        "lens_wisp",
        "wrack_eel",
        "storm_rat",
        "ridge_bandit",
        "gale_hound",
        "gloomfin",
        "frostmane",
        "lenswarden",
      ]),
      "Winning this battle earns “Field Researcher” and “Roadwise”.",
      ["catalogue", "wanderers"],
    ],
  ];
  for (const [id, book, text, earned] of cases) {
    const { game, events } = harness(id, book);
    assertForecast(game, text);
    winAndCheck(game, events, earned);
  }
});

test("each individual field foe forecast becomes its hardcoded feat after Attack", () => {
  for (const [id, title, feat] of [
    ["old_tusk", "Tusk Breaker", "tusk"],
    ["gloomfin", "Seawall Sentinel", "gloomfin"],
    ["frostmane", "Packbreaker", "frostmane"],
    ["lenswarden", "Vault Keeper", "lenswarden"],
    ["cinderclaw", "Dune Breaker", "cinderclaw"],
    ["thunderhoof", "Stampede Stopped", "thunderhoof"],
    ["glacierward_colossus", "Thaw the Sentinel", "glacierward"],
  ]) {
    const { game, events } = harness(id);
    assertForecast(game, `Winning this battle earns “${title}”.`);
    winAndCheck(game, events, [feat]);
  }
});

test("repeat foes and below-threshold ordinary foes do not invent a new feat", () => {
  for (const [id, book] of [
    ["old_tusk", { old_tusk: 1 }],
    ["storm_rat", {}],
  ]) {
    const { game, events } = harness(id, book);
    assertForecast(game, null);
    winAndCheck(game, events, []);
  }
  const { game } = harness(
    "storm_rat",
    bookOf(["gloomfin", "frostmane", "lenswarden", ...OTHER_FOES]),
  );
  const before = structuredClone(game.state);
  for (const id of ["not_a_foe", "__proto__", "", null, 42]) {
    assert.equal(featCombatText(game.state, { enemy: { id } }), null);
  }
  assert.deepEqual(game.state, before);
});

test("an actual Warlord drill gives half XP without forecast or journal victory", () => {
  const { game, events } = harness(
    "pass_warlord",
    bookOf(["gloomfin", "frostmane", "lenswarden", ...OTHER_FOES]),
    true,
  );
  assertForecast(game, null);
  const before = structuredClone(game.state);
  combatScene.actions.attack(game);
  const state = game.state;
  assert.equal(state.combat.over, "victory");
  assert.equal(
    state.party[0].xp,
    before.party[0].xp + Math.floor(before.combat.enemy.xp / 2),
  );
  assert.deepEqual(state.bestiary, before.bestiary);
  assert.deepEqual(state.story, before.story);
  assert.deepEqual(state.inventory, before.inventory);
  assert.equal(state.gold, before.gold);
  assert.deepEqual(featStatus(state), featStatus(before));
  assert.equal(events.filter((name) => name === "combat:victory").length, 0);
  assert.ok(!combatScene.render(game).includes('class="feat-reach-note"'));
  const paid = structuredClone(state);
  combatScene.actions.attack(game);
  paid.combat.log.push("The battle is over.");
  assert.deepEqual(state, paid);
});

test("frozen repeated reads are RNG-free, hostile text escapes once, and terminal scenes omit forecasts", () => {
  const { game } = harness("old_tusk");
  freeze(game.state);
  for (let i = 0; i < 3; i++)
    assertForecast(game, "Winning this battle earns “Tusk Breaker”.");
  assert.equal(
    featReachNote(game.state.combat, "<img>& “test”"),
    '<p class="feat-reach-note"><span class="feat-reach-note__label">Feat in reach:</span> &lt;img&gt;&amp; “test”</p>',
  );
  // Terminal rendering fixtures only; victory-wiring tests above never set combat.over.
  for (const over of ["victory", "defeat", "fled"]) {
    const terminal = harness("old_tusk").game;
    terminal.state.combat.over = over;
    freeze(terminal.state);
    const before = structuredClone(terminal.state);
    assert.ok(
      !combatScene.render(terminal).includes('class="feat-reach-note"'),
    );
    assert.equal(featReachNote(terminal.state.combat, "still forecast?"), "");
    assert.deepEqual(terminal.state, before);
  }
});
