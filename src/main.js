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
import { installRecipeBook } from './scenes/recipes.js';
import { endingScene, installEnding } from './scenes/ending.js';
import { installAudio } from './audio/controls.js';
import { installQuestJournal } from './scenes/quests.js';
import { guideScene } from './scenes/guide.js';
import { installCharacter } from './scenes/character.js';

const game = new Game(document.getElementById('app'));
game.registerScene('title', titleScene);
game.registerScene('town', townScene);
game.registerScene('combat', combatScene);
game.registerScene('ending', endingScene);
game.registerScene('guide', guideScene);
installStory(game);
installProgression(game);
installMap(game); // registers the 'explore' scene
installShop(game); // registers the 'shop' scene (Hesta's Goods)
installBag(game); // registers the 'bag' scene (inventory screen)
installCompanions(game); // registers the 'muster' scene (recruit companions)
installQuestJournal(game);
installBestiary(game); // registers the 'bestiary' scene + records defeated foes
installCharacter(game); // registers Wren's read-only character sheet
installRecipeBook(game); // registers the 'recipes' scene (Field Recipe Book)
installEnding(game); // after installStory so the story state is already updated
installAudio(game); // creates no AudioContext until the player explicitly enables sound
game.setScene('title');
window.game = game; // handy for debugging
