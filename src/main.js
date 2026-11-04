import { Game } from './engine.js';
import { titleScene } from './scenes/title.js';
import { townScene } from './scenes/town.js';
import { combatScene } from './scenes/combat.js';
import { installStory } from './story/integration.js';
import { installProgression } from './core/progression.js';
import { endingScene, installEnding } from './scenes/ending.js';

const game = new Game(document.getElementById('app'));
game.registerScene('title', titleScene);
game.registerScene('town', townScene);
game.registerScene('combat', combatScene);
game.registerScene('ending', endingScene);
installStory(game);
installProgression(game);
installEnding(game); // after installStory so the story state is already updated
game.setScene('title');
window.game = game; // handy for debugging
