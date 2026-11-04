import { Game } from './engine.js';
import { titleScene } from './scenes/title.js';
import { townScene } from './scenes/town.js';
import { combatScene } from './scenes/combat.js';
import { installStory } from './story/integration.js';
import { installProgression } from './core/progression.js';
import { installMap } from './map/index.js';

const game = new Game(document.getElementById('app'));
game.registerScene('title', titleScene);
game.registerScene('town', townScene);
game.registerScene('combat', combatScene);
installStory(game);
installProgression(game);
installMap(game); // registers the 'explore' scene
game.setScene('title');
window.game = game; // handy for debugging
