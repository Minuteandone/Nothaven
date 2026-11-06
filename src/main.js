import { installAutosave } from './state.js';
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
import { installFeats } from './scenes/feats.js';
import { installDrills } from './scenes/drills.js';
import { installBounties } from './scenes/bounties.js';
import { installForge } from './scenes/forge.js';
import { guideScene } from './scenes/guide.js';
import { installCharacter } from './scenes/character.js';
import { installDisplayControls } from './ui/displayControls.js';
import { installCombatControls } from './ui/combatControls.js';
import { installExplorationControls } from './ui/explorationControls.js';
import { installAnimations } from './ui/animations.js';
import { installJourneyArchive } from './scenes/archive.js';
import { installLedger } from './core/ledger.js';

const game = new Game(document.getElementById('app'));
game.registerScene('title', titleScene);
game.registerScene('town', townScene);
game.registerScene('combat', combatScene);
installCombatControls(game); // combat-scoped shortcuts click existing enabled buttons
game.registerScene('ending', endingScene);
game.registerScene('guide', guideScene);
installJourneyArchive(game);
installStory(game);
installProgression(game);
installLedger(game); // Service Record tallies for real battles (drills are not counted)
installMap(game); // registers the 'explore' scene
installExplorationControls(game); // exploration-scoped Survey and nearby-action shortcuts
installShop(game); // registers the 'shop' scene (Hesta's Goods)
installBag(game); // registers the 'bag' scene (inventory screen)
installCompanions(game); // registers the 'muster' scene (recruit companions)
installQuestJournal(game);
installFeats(game);
installDrills(game);
installBounties(game); // Greyhaven bounty board: repeatable hunt contracts (real victories only)
installForge(game);
installBestiary(game); // registers the 'bestiary' scene + records defeated foes
installCharacter(game); // registers Wren's read-only character sheet
installRecipeBook(game); // registers the 'recipes' scene (Field Recipe Book)
installEnding(game); // after installStory so the story state is already updated
installAudio(game); // creates no AudioContext until the player explicitly enables sound
installDisplayControls(game); // device-local interface preferences; no game-state changes
installAnimations(game); // combat + level-up screen effects (shake/fade/popups)
installAutosave(game);
game.setScene('title');
window.game = game; // handy for debugging
