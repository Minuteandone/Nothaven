import { renderCharacter } from '../ui/character.js';

export const characterScene = {
  onEnter(game, data = {}) {
    game.characterReturn = data.returnScene || game.characterReturn || 'town';
  },
  render(game) {
    return renderCharacter({ member: game.state.party?.[0], returnScene: game.characterReturn || 'town' });
  },
  actions: {
    leave(game) {
      const target = game.scenes?.[game.characterReturn] ? game.characterReturn : 'town';
      game.setScene(target);
    },
  },
};

export function installCharacter(game) {
  game.registerScene('character', characterScene);
}
