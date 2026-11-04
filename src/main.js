import { Game } from './engine.js';
import { titleScene } from './scenes/title.js';
import { townScene } from './scenes/town.js';
import { combatScene } from './scenes/combat.js';
import { installStory } from './story/integration.js';
import { installProgression } from './core/progression.js';
import { installMap } from './map/index.js';
import { installShop } from './scenes/shop.js';
import { installBag } from './scenes/bag.js';
import { installCompanions } from './scenes/muster.js';
import { installBestiary } from './scenes/bestiary.js';
import { endingScene, installEnding } from './scenes/ending.js';

const game = new Game(document.getElementById('app'));
game.registerScene('title', titleScene);
game.registerScene('town', townScene);
game.registerScene('combat', combatScene);
game.registerScene('ending', endingScene);
installStory(game);
installProgression(game);
installMap(game); // registers the 'explore' scene
installShop(game); // registers the 'shop' scene (Hesta's Goods)
installBag(game); // registers the 'bag' scene (inventory screen)
installCompanions(game); // registers the 'muster' scene (recruit companions)
installBestiary(game); // registers the 'bestiary' scene + records defeated foes
installEnding(game); // after installStory so the story state is already updated
game.setScene('title');
window.game = game; // handy for debugging
