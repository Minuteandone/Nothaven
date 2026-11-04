import { Game } from './engine.js';
import { titleScene } from './scenes/title.js';
import { townScene } from './scenes/town.js';
import { combatScene } from './scenes/combat.js';
import { installStory } from './story/integration.js';

const game = new Game(document.getElementById('app'));
game.registerScene('title', titleScene);
game.registerScene('town', townScene);
game.registerScene('combat', combatScene);
installStory(game);
game.setScene('title');
window.game = game; // handy for debugging
