// /public/js/main.js
import { CombatManager } from './CombatManager/index.js';
import { socketManager } from './Network/index.js';
import { fetchCharacterClasses, CharacterClasses } from './Entities/index.js';
import { fetchAbilitiesForClass, ActionTypes } from './Actions/index.js';

// Global state
let combatManager;

// DOM elements
const roomScreen = document.getElementById('room-screen');
const combatScreen = document.getElementById('combat-screen');
const resultScreen = document.getElementById('result-screen');

const loginForm = document.getElementById('login-form');
const roomInfo = document.getElementById('room-info');
const usernameInput = document.getElementById('username');
const roomIdInput = document.getElementById('room-id');
const joinBtn = document.getElementById('join-btn');
const startCombatBtn = document.getElementById('start-combat-btn');
const leaveRoomBtn = document.getElementById('leave-room-btn');
const roomIdDisplay = document.getElementById('room-id-display');
const playerList = document.getElementById('player-list');

const characterCreationScreen = document.getElementById('character-creation');
const backToLoginBtn = document.getElementById('back-to-login-btn');
const createCharacterBtn = document.getElementById('create-character-btn');
const classOptions = document.querySelectorAll('.class-option');
let selectedClass = null;
let CharacterFeats = {};

// Initialize application
function initialize() {
  // Create combat manager with explicit dependencies
  combatManager = new CombatManager(socketManager);

  // Setup UI event listeners
  setupEventListeners();

  // Setup Socket.io event listeners - make sure this line is here!
  setupSocketListeners();

  Promise.all([
    fetchCharacterClasses(),
    fetchCharacterFeats()
  ]).then(() => {
    console.log('Character data loaded');
  });

  // Show login form
  showLoginForm();

  console.log('Application initialized. Socket connected:', socketManager.isConnected());
}

// Setup UI event listeners
function setupEventListeners() {
  // Join room button
  joinBtn.addEventListener('click', () => {
    const username = usernameInput.value.trim();
    const roomId = roomIdInput.value.trim();

    if (!username || !roomId) {
      alert('Please enter a username and room ID');
      return;
    }

    // Show character creation instead of joining immediately
    showCharacterCreation();
  });

  // Start combat button
  startCombatBtn.addEventListener('click', () => {
    console.log('Start combat button clicked');
    socketManager.startCombat();
  });

  // Leave room button
  leaveRoomBtn.addEventListener('click', () => {
    socketManager.leaveRoom();
    showLoginForm();
  });

  backToLoginBtn.addEventListener('click', () => {
    showLoginForm();
  });

  // Class selection
  classOptions.forEach(option => {
    option.addEventListener('click', () => {
      // Remove selected class from all options
      classOptions.forEach(opt => opt.classList.remove('selected'));

      // Add selected class to clicked option
      option.classList.add('selected');

      // Store selected class
      selectedClass = option.getAttribute('data-class');

      generateFeatOptions(selectedClass);

      // Update character preview
      updateCharacterPreview(selectedClass);

      // Enable create button
      createCharacterBtn.disabled = false;
    });
  });

  // Create character button
  createCharacterBtn.addEventListener('click', () => {
    if (!selectedClass) return;

    const username = usernameInput.value.trim();
    const roomId = roomIdInput.value.trim();

    if (!username || !roomId) {
      alert('Please enter a username and room ID');
      return;
    }

    const selectedFeats = getSelectedFeats();

    // Join room with character class
    socketManager.joinRoom(username, roomId, selectedClass, selectedFeats);
  });
}

function showCharacterCreation() {
  loginForm.classList.add('hidden');
  characterCreationScreen.classList.remove('hidden');
  roomInfo.classList.add('hidden');

  // Generate class options dynamically
  generateClassOptions();

  // Reset selection
  selectedClass = null;
  createCharacterBtn.disabled = true;

  // Reset preview
  updateCharacterPreview(null);
}

async function updateCharacterPreview(className) {
  const abilityScoresPreview = document.getElementById('ability-scores-preview');
  const previewAC = document.getElementById('preview-ac');
  const previewHP = document.getElementById('preview-hp');
  const previewAbilities = document.getElementById('preview-abilities');

  // Clear abilities list
  if (previewAbilities) {
    previewAbilities.innerHTML = '';
  }

  if (!className) {
    // Default values
    const abilities = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
    abilities.forEach(ability => {
      const abilityElement = abilityScoresPreview.querySelector(
        `.ability-score:nth-child(${abilities.indexOf(ability) + 1})`);
      const valueElement = abilityElement.querySelector('.ability-value');

      // Clear any existing classes
      valueElement.className = 'ability-value';

      // Set value to 0
      valueElement.textContent = '0';
    });

    previewAC.textContent = '10';
    previewHP.textContent = '50'; // Default HP
    return;
  }

  // Get class template
  const classTemplate = CharacterClasses[className] || await fetchClass(className);

  if (!classTemplate) return;

  // Update ability scores
  for (const [ability, value] of Object.entries(classTemplate.baseAbilityScores)) {
    const abilityShort = ability.substring(0, 3).toUpperCase();
    const abilityIndex = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'].indexOf(abilityShort);

    if (abilityIndex !== -1) {
      const abilityElement = abilityScoresPreview.querySelector(
        `.ability-score:nth-child(${abilityIndex + 1})`);
      const valueElement = abilityElement.querySelector('.ability-value');

      // Clear any existing classes
      valueElement.className = 'ability-value';

      // Set the formatted text with proper color
      if (value > 0) {
        valueElement.classList.add('ability-positive');
        valueElement.textContent = '+' + value;
      } else if (value < 0) {
        valueElement.classList.add('ability-negative');
        valueElement.textContent = value; // Already has minus sign
      } else {
        valueElement.textContent = '0';
      }
    }
  }

  // Update AC and HP
  previewAC.textContent = classTemplate.baseAC;

  // Update base HP
  let baseHP = 50; // Default
  if (className === 'FIGHTER') baseHP = 70;
  else if (className === 'WIZARD') baseHP = 40;
  else if (className === 'ROGUE') baseHP = 50;

  // Add constitution directly to base HP
  const constitution = classTemplate.baseAbilityScores.constitution;
  const hp = baseHP + constitution;

  previewHP.textContent = hp;

  // Get selected feats
  const selectedFeats = getSelectedFeats();

  // Apply feat bonuses to character preview
  if (selectedFeats.length > 0) {
    // Create a copy of the base ability scores
    const modifiedScores = { ...classTemplate.baseAbilityScores };
    let additionalHealth = 0;

    // Apply feat bonuses
    selectedFeats.forEach(featId => {
      const feat = CharacterFeats[featId];
      if (feat) {
        // Apply ability score bonuses
        if (feat.bonuses.abilityScores) {
          for (const [stat, bonus] of Object.entries(feat.bonuses.abilityScores)) {
            modifiedScores[stat] = (modifiedScores[stat] || 0) + bonus;
          }
        }

        // Apply health bonus
        if (feat.bonuses.health) {
          additionalHealth += feat.bonuses.health;
        }
      }
    });

    // Update ability score display with modified values
    for (const [ability, value] of Object.entries(classTemplate.baseAbilityScores)) {
      const abilityShort = ability.substring(0, 3).toUpperCase();
      const abilityIndex = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'].indexOf(abilityShort);

      if (abilityIndex !== -1) {
        const abilityElement = abilityScoresPreview.querySelector(
          `.ability-score:nth-child(${abilityIndex + 1})`);
        const valueElement = abilityElement.querySelector('.ability-value');

        // Clear any existing classes
        valueElement.className = 'ability-value';

        // Set the formatted text with proper color
        if (value > 0) {
          valueElement.classList.add('ability-positive');
          valueElement.textContent = '+' + value;
        } else if (value < 0) {
          valueElement.classList.add('ability-negative');
          valueElement.textContent = value; // Already has minus sign
        } else {
          valueElement.textContent = '0';
        }
      }
    }

    // Update HP with additional health from feats
    const baseHP = parseInt(previewHP.textContent);
    previewHP.textContent = (baseHP + additionalHealth).toString();

    // Show selected feats in preview
    const featsPreview = document.getElementById('preview-feats');
    if (featsPreview) {
      featsPreview.innerHTML = '';
      selectedFeats.forEach(featId => {
        const feat = CharacterFeats[featId];
        if (feat) {
          const featItem = document.createElement('li');
          featItem.textContent = feat.name;
          featsPreview.appendChild(featItem);
        }
      });
    }
  }

  // Update abilities list if the element exists
  if (previewAbilities && classTemplate.abilities) {
    // Try to fetch detailed ability information
    try {
      const abilities = await fetchAbilitiesForClass(className);

      abilities.forEach(ability => {
        const abilityItem = document.createElement('li');

        // Create name with energy cost (if any)
        const nameSpan = document.createElement('span');
        nameSpan.className = 'ability-name';
        nameSpan.textContent = ability.name;

        if (ability.energyCost > 0) {
          nameSpan.textContent += ` (${ability.energyCost} energy)`;
        }

        abilityItem.appendChild(nameSpan);

        // Add description if available
        if (ability.description) {
          const descSpan = document.createElement('div');
          descSpan.className = 'ability-description';
          descSpan.textContent = ability.description;
          abilityItem.appendChild(descSpan);
        }

        previewAbilities.appendChild(abilityItem);
      });
    } catch (error) {
      // Fallback to just ability names if detailed info fails
      console.error('Error fetching detailed ability info:', error);

      classTemplate.abilities.forEach(abilityId => {
        const abilityItem = document.createElement('li');
        abilityItem.textContent = abilityId;
        previewAbilities.appendChild(abilityItem);
      });
    }
  }
}

async function fetchClass(className) {
  try {
    const response = await fetch('/api/classes');
    const classes = await response.json();
    CharacterClasses = classes; // Store for future use
    return classes[className];
  } catch (error) {
    console.error(`Error fetching class ${className}:`, error);
    return null;
  }
}

async function fetchCharacterFeats() {
  try {
    const response = await fetch('/api/feats');

    // Check if the response is OK before parsing
    if (!response.ok) {
      console.error('Feats API returned error:', response.status);
      return {};
    }

    const feats = await response.json();
    console.log('Feats data loaded:', Object.keys(feats).length); // Add debugging
    CharacterFeats = feats; // Update the variable
    return feats;
  } catch (error) {
    console.error('Error fetching character feats:', error);
    // Return a fallback with some minimal data so the UI doesn't break
    return {
      WEAPON_MASTER: {
        id: 'WEAPON_MASTER',
        name: 'Weapon Master',
        description: 'Extensive training with weapons provides greater combat effectiveness.',
        bonuses: { abilityScores: { strength: 1 } },
        abilities: [],
        passiveEffects: ['increaseCritRange']
      },
      TOUGH: {
        id: 'TOUGH',
        name: 'Tough',
        description: 'Your health is bolstered beyond normal limits.',
        bonuses: { health: 10 },
        abilities: [],
        passiveEffects: []
      }
    };
  }
}

function getSelectedFeats() {
  const selectedFeats = [];
  const checkboxes = document.querySelectorAll('.feat-select input[type="checkbox"]:checked');

  checkboxes.forEach(checkbox => {
    const featId = checkbox.getAttribute('data-feat-id');
    if (featId) {
      selectedFeats.push(featId);
    }
  });

  console.log('Selected feats:', selectedFeats); // Debugging log
  return selectedFeats;
}

// Setup Socket.io event listeners
function setupSocketListeners() {
  // Room joined event
  socketManager.on('roomJoined', (data) => {
    // Update room info
    roomIdDisplay.textContent = data.roomId;
    updatePlayerList(data.players);

    // Show room info
    showRoomInfo();

    // console.log('Start combat button in DOM:', document.getElementById('start-combat-btn'));
    // console.log('Room info container:', document.getElementById('room-info'));
    // console.log('Room info display style:', document.getElementById('room-info').style.display);
  });

  // Player joined event
  socketManager.on('playerJoined', (playerData) => {
    addPlayerToList(playerData);
  });

  // Player left event
  socketManager.on('playerLeft', (data) => {
    removePlayerFromList(data.id);
  });

  // Room error event
  socketManager.on('roomError', (data) => {
    alert(`Error: ${data.message}`);
  });
}

// Show login form
function showLoginForm() {
  loginForm.classList.remove('hidden');
  characterCreationScreen.classList.add('hidden');
  roomInfo.classList.add('hidden');

  // Reset input fields
  usernameInput.value = '';
  roomIdInput.value = '';

  // Clear player list
  playerList.innerHTML = '';
}

// Show room info
function showRoomInfo() {
  loginForm.classList.add('hidden');
  characterCreationScreen.classList.add('hidden');
  roomInfo.classList.remove('hidden');

  // Make sure the start combat button is visible
  startCombatBtn.style.display = 'block';

  // console.log('Room info displayed, combat button should be visible');
}

// Update player list
function updatePlayerList(players) {
  // Clear list
  playerList.innerHTML = '';

  // Add each player
  players.forEach(player => {
    addPlayerToList(player);
  });
}

// Add player to list
function addPlayerToList(player) {
  const playerItem = document.createElement('li');
  playerItem.setAttribute('data-player-id', player.id);

  // Highlight local player
  const isLocalPlayer = player.id === socketManager.getSocketId();
  if (isLocalPlayer) {
    playerItem.classList.add('local-player');
  }

  // Create player info with class if available
  const nameSpan = document.createElement('span');
  nameSpan.className = 'player-name';
  nameSpan.textContent = `${player.username}${isLocalPlayer ? ' (You)' : ''}`;

  playerItem.appendChild(nameSpan);

  if (player.characterClass) {
    const classSpan = document.createElement('span');
    classSpan.className = 'player-class';
    classSpan.textContent = player.characterClass.charAt(0) + player.characterClass.slice(1).toLowerCase();
    playerItem.appendChild(classSpan);
  }

  playerList.appendChild(playerItem);
}

// Remove player from list
function removePlayerFromList(playerId) {
  const playerItem = playerList.querySelector(`[data-player-id="${playerId}"]`);
  if (playerItem) {
    playerList.removeChild(playerItem);
  }
}

// Generate class options dynamically
function generateClassOptions() {
  const container = document.getElementById('dynamic-class-options');
  container.innerHTML = '';

  for (const [className, classData] of Object.entries(CharacterClasses)) {
    const classOption = document.createElement('div');
    classOption.className = 'class-option';
    classOption.setAttribute('data-class', className);

    const nameHeader = document.createElement('h4');
    nameHeader.textContent = classData.name;

    const statList = document.createElement('ul');
    statList.className = 'stat-preview';

    // Add key stats
    // for (const [stat, value] of Object.entries(classData.baseAbilityScores)) {
    //   if (['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom'].includes(stat)) {
    //     const statItem = document.createElement('li');
    //     const statName = stat.substring(0, 3).toUpperCase();

    //     // Create the stat name element
    //     const statNameElement = document.createElement('span');
    //     statNameElement.textContent = statName + ' ';

    //     // Create the value element with color
    //     const statValueElement = document.createElement('span');
    //     statValueElement.className = 'stat-value';

    //     if (value > 0) {
    //       statValueElement.classList.add('ability-positive');
    //       statValueElement.textContent = '+' + value;
    //     } else if (value < 0) {
    //       statValueElement.classList.add('ability-negative');
    //       statValueElement.textContent = value; // Already has minus sign
    //     } else {
    //       statValueElement.textContent = '0';
    //     }

    //     statItem.appendChild(statNameElement);
    //     statItem.appendChild(statValueElement);
    //     statList.appendChild(statItem);
    //   }
    // }

    // // Add AC
    // const acItem = document.createElement('li');
    // acItem.textContent = `AC: ${classData.baseAC}`;
    // statList.appendChild(acItem);

    // Append elements
    classOption.appendChild(nameHeader);
    // classOption.appendChild(statList);

    // Add click event
    classOption.addEventListener('click', () => {
      document.querySelectorAll('.class-option').forEach(opt =>
        opt.classList.remove('selected'));
      classOption.classList.add('selected');
      selectedClass = className;
      updateCharacterPreview(className);
      document.getElementById('create-character-btn').disabled = false;
    });

    container.appendChild(classOption);
  }
}

// Modify the generateFeatOptions function to add more debugging
function generateFeatOptions(className) {
  const featContainer = document.getElementById('feat-options');
  featContainer.innerHTML = '';

  // Add debugging to check available feats
  console.log(`Generating feats for class: ${className}`);
  console.log(`Class data:`, CharacterClasses[className]);

  // Get available feats for the class
  const availableFeats = CharacterClasses[className]?.availableFeats || [];
  console.log(`Available feats for ${className}:`, availableFeats);

  if (!className) {
    featContainer.innerHTML = '<p>Please select a class first</p>';
    return;
  }

  if (availableFeats.length === 0) {
    featContainer.innerHTML = '<p>No feats available for this class</p>';
    return;
  }

  // Log the CharacterFeats object to make sure it's populated
  console.log('Full feats data:', CharacterFeats);

  // Continue rendering feats...
  availableFeats.forEach(featId => {
    console.log(`Processing feat: ${featId}, data:`, CharacterFeats[featId]);

    const feat = CharacterFeats[featId];
    if (!feat) {
      console.warn(`Feat ${featId} not found in CharacterFeats data`);
      return;
    }

    const featOption = document.createElement('div');
    featOption.className = 'feat-option';
    featOption.setAttribute('data-feat-id', featId);

    const nameHeader = document.createElement('h5');
    nameHeader.textContent = feat.name;

    const description = document.createElement('p');
    description.className = 'feat-description';
    description.textContent = feat.description;

    const bonusList = document.createElement('ul');
    bonusList.className = 'feat-bonuses';

    // Add ability score bonuses
    if (feat.bonuses.abilityScores) {
      for (const [stat, bonus] of Object.entries(feat.bonuses.abilityScores)) {
        const bonusItem = document.createElement('li');
        bonusItem.textContent = `+${bonus} ${stat.toUpperCase()}`;
        bonusList.appendChild(bonusItem);
      }
    }

    // Add health bonus
    if (feat.bonuses.health) {
      const bonusItem = document.createElement('li');
      bonusItem.textContent = `+${feat.bonuses.health} HP`;
      bonusList.appendChild(bonusItem);
    }

    // Add abilities granted
    if (feat.abilities && feat.abilities.length > 0) {
      const abilitiesItem = document.createElement('li');
      abilitiesItem.textContent = `New Abilities: ${feat.abilities.join(', ')}`;
      bonusList.appendChild(abilitiesItem);
    }

    // Add passive effects
    if (feat.passiveEffects && feat.passiveEffects.length > 0) {
      const passivesItem = document.createElement('li');
      passivesItem.textContent = `Passive Effects: ${feat.passiveEffects.join(', ')}`;
      bonusList.appendChild(passivesItem);
    }

    // Create checkbox for selection
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `feat-${featId}`;
    checkbox.setAttribute('data-feat-id', featId);

    const label = document.createElement('label');
    label.htmlFor = `feat-${featId}`;
    label.textContent = 'Select';

    const checkboxContainer = document.createElement('div');
    checkboxContainer.className = 'feat-select';
    checkboxContainer.appendChild(checkbox);
    checkboxContainer.appendChild(label);

    // Append all elements
    featOption.appendChild(nameHeader);
    featOption.appendChild(description);
    featOption.appendChild(bonusList);
    featOption.appendChild(checkboxContainer);

    featContainer.appendChild(featOption);
  });
}

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', initialize);