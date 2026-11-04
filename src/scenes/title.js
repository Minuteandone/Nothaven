import { createInitialState, loadGame, hasSave } from '../state.js';

export const titleScene = {
  render() {
    return `<div class="panel"><h1>Beacon of Stormhaven</h1>
      <p>The storms have broken the beacon that shields Greyhaven. Someone must set it alight again.</p>
      <button data-action="newGame">New Game</button>
      <button data-action="continue" ${hasSave() ? '' : 'disabled'}>Continue</button></div>`;
  },
  actions: {
    newGame(game) { game.state = createInitialState(); game.setScene('town'); },
    continue(game) { const s = loadGame(); if (s) { game.state = s; game.setScene('town'); } },
  },
};
