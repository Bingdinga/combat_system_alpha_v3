// /public/js/CombatUI/index.js

import { ComponentFactory } from './ComponentFactory.js';
import { EntityRenderer } from './EntityRenderer.js';
import { ModalManager } from './ModalManager.js';
import { EventHandlers } from './EventHandlers.js';
import { ActionTypes, getAction, fetchAbilitiesForClass } from '../Actions/index.js';
import { CombatLog } from './CombatLog.js';

export class CombatUI {
  constructor(combatManager) {
    this.combatManager = combatManager;
    this.combatLog = null;

    // Cache DOM elements
    this.cacheElements();

    // Initialize helper modules
    this.initializeHelpers();

    // Setup event listeners
    this.setupEventListeners();
  }

  // Cache all frequently used DOM elements
  cacheElements() {
    this.combatScreen = document.getElementById('combat-screen');
    this.playerEntitiesContainer = document.getElementById('player-entities');
    this.enemyEntitiesContainer = document.getElementById('enemy-entities');
    this.actionPointsContainer = document.getElementById('action-points-container');
    this.attackBtn = document.getElementById('attack-btn');
    this.castBtn = document.getElementById('cast-btn');
    this.combatTimer = document.getElementById('combat-timer');

    // Modal elements
    this.selectionModal = document.getElementById('selection-modal');
    this.selectionTitle = document.getElementById('selection-title');
    this.selectionOptions = document.getElementById('selection-options');
    this.cancelSelectionBtn = document.getElementById('cancel-selection-btn');

    this.targetInfoElement = document.getElementById('current-target-info');

    // Add turn-based UI elements
    this.turnInfoDisplay = document.getElementById('turn-info-display');
    this.turnOrderContainer = document.getElementById('turn-order-container');
    this.turnTimerDisplay = document.getElementById('turn-timer');
    this.endTurnBtn = document.getElementById('end-turn-btn');

    this.combatLogElement = document.getElementById('combat-log');
  }

  initializeHelpers() {
    // Create helpers in dependency order
    this.componentFactory = new ComponentFactory(this.combatManager);
    this.entityRenderer = new EntityRenderer(this.componentFactory);
    this.modalManager = new ModalManager(
      this.selectionModal,
      this.selectionTitle,
      this.selectionOptions,
      this.componentFactory
    );
    this.eventHandlers = new EventHandlers(this.combatManager, this.modalManager);
    this.combatLog = new CombatLog(this.combatLogElement);
  }

  // Initialize the UI with combat data
  initializeCombat(combatState) {
    // console.log('[CLIENT] CombatUI.initializeCombat called with state:', combatState);

    // Clear containers
    this.clearEntityContainers();

    // Render entities
    this.renderEntities(combatState.entities);

    // Update action points
    this.updateActionPoints();

    // Reset combat timer
    this.updateCombatTimer(0);

    // Show combat screen
    this.showCombatScreen();

    // Initialize combat log with existing entries
    if (combatState.log && combatState.log.length > 0) {
      this.combatLog.clear();
      this.combatLog.addEntries(combatState.log);
    }
  }

  clearEntityContainers() {
    this.playerEntitiesContainer.innerHTML = '';
    this.enemyEntitiesContainer.innerHTML = '';
  }

  // Show the combat screen
  showCombatScreen() {
    document.querySelectorAll('.screen').forEach(screen => {
      screen.classList.remove('active');
    });
    this.combatScreen.classList.add('active');
  }

  updateSelectedEntity(selectedId) {
    // console.log('CombatUI.updateSelectedEntity called with:', selectedId);

    if (this.entityRenderer) {
      this.entityRenderer.updateSelectedEntity(selectedId);
    } else {
      console.error('entityRenderer is undefined');
    }

    // Update the target info text if the element exists
    const targetInfoElement = document.getElementById('current-target-info');
    if (targetInfoElement) {
      if (selectedId) {
        const target = this.combatManager.state.entities.find(e => e.id === selectedId);
        if (target) {
          targetInfoElement.textContent = `Current target: ${target.name}`;
          targetInfoElement.classList.remove('hidden');
        }
      } else {
        targetInfoElement.textContent = 'No target selected';
        targetInfoElement.classList.add('hidden');
      }
    }
  }

  // Render all entities
  renderEntities(entities) {
    this.clearEntityContainers();

    // Group entities by type
    const players = entities.filter(entity => entity.type === 'player');
    const enemies = entities.filter(entity => entity.type === 'enemy');

    // Render each group
    players.forEach(player => {
      const playerElement = this.entityRenderer.createEntityElement(player, this.combatManager);
      this.playerEntitiesContainer.appendChild(playerElement);
    });

    enemies.forEach(enemy => {
      const enemyElement = this.entityRenderer.createEntityElement(enemy, this.combatManager);
      this.enemyEntitiesContainer.appendChild(enemyElement);
    });
  }

  // Update entity UI element
  updateEntityElement(entity) {
    const entityEl = document.querySelector(`.entity-card[data-entity-id="${entity.id}"]`);
    if (!entityEl) return;
    this.entityRenderer.updateEntityElement(entity, entityEl);
  }

  // Show floating text for damage, healing, etc.
  showFloatingText(entityId, text, type = 'damage') {
    this.entityRenderer.showFloatingText(entityId, text, type);
  }

  // Update action points display for local player
  updateActionPoints() {
    const localPlayer = this.combatManager.getLocalPlayer();
    if (!localPlayer) return;

    // Instead of using ActionPointManager, just update action buttons
    this.updateActionButtons();

    // Find and update the action points text element
    const apText = document.querySelector('#action-points-container .action-points-text');
    if (apText) {
      apText.textContent = `Action Points: ${Math.floor(localPlayer.actionPoints)}/${localPlayer.maxActionPoints}`;
    }
  }

  updateActionButtons(isPlayerTurn) {
    // console.log('Updating action buttons, isPlayerTurn:', isPlayerTurn); // Add debug logging

    // Enable/disable action buttons based on whose turn it is
    const buttons = [this.attackBtn, this.castBtn, this.endTurnBtn];

    buttons.forEach(btn => {
      if (btn) {
        // console.log(`Button ${btn.id} before: disabled=${btn.disabled}`); // Debug log

        // First disable based on turn
        btn.disabled = !isPlayerTurn;

        // If it's the player's turn, check other conditions (like sufficient action points)
        if (isPlayerTurn) {
          const localPlayer = this.combatManager.getLocalPlayer();
          // console.log('Local player:', localPlayer); // Debug log

          if (btn === this.attackBtn || btn === this.castBtn) {
            btn.disabled = !localPlayer || localPlayer.actionPoints < 1 || localPlayer.health <= 0;
          }

          if (btn === this.castBtn) {
            btn.disabled = btn.disabled || localPlayer.energy < 20;
          }
        }

        // console.log(`Button ${btn.id} after: disabled=${btn.disabled}`); // Debug log
      }
    });
  }

  showTurnNotification(message) {
    // Create and show a turn notification
    const notification = document.createElement('div');
    notification.className = 'turn-notification';
    notification.textContent = message;

    document.body.appendChild(notification);

    // Remove after animation
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 3000);
  }

  showTurnSummary(message, actions) {
    // Instead of showing a floating notification, we'll just add it to the combat log
    const entry = {
      time: Date.now(),
      message: message,
      type: 'turn'
    };
    this.combatLog.addEntry(entry);
  }

  // Add this helper method to find the detailed log entry for an action
  findLogEntryForAction(action) {
    if (!this.combatManager || !this.combatManager.state || !this.combatManager.state.log) {
      return null;
    }

    // Look through the log entries to find one that matches this action
    // We'll look for entries with matching action type, target, and timestamps close to each other
    const actionTimestamp = action.timestamp;

    // Get log entries for the current turn
    const relevantEntries = this.combatManager.state.log.filter(entry => {
      return entry.action === action.type &&
        entry.targetId === action.targetId &&
        Math.abs(entry.time - actionTimestamp) < 1000; // Within 1 second
    });

    // Return the most recent matching entry
    return relevantEntries.length > 0 ?
      relevantEntries.reduce((latest, entry) =>
        entry.time > latest.time ? entry : latest, relevantEntries[0]) :
      null;
  }

  // Update combat timer
  updateCombatTimer(duration) {
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    this.combatTimer.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  // Setup event listeners
  setupEventListeners() {
    this.eventHandlers.setupAttackButtonHandler(this.attackBtn);
    this.eventHandlers.setupCastButtonHandler(this.castBtn);
    this.eventHandlers.setupCancelButtonHandler(this.cancelSelectionBtn);

    // Add end turn button handler
    if (this.endTurnBtn) {
      this.endTurnBtn.addEventListener('click', () => {
        this.combatManager.endTurn();
      });
    }

    document.addEventListener('keydown', this.handleKeyPress.bind(this));
  }

  handleKeyPress(event) {
    // Only process keyboard shortcuts during active combat and when it's player's turn
    if (!this.combatManager || !this.combatManager.state.active ||
      !this.combatManager.currentTurn.isLocalPlayerTurn) {
      return;
    }

    const key = event.key;

    // Check if a modal is open
    const isModalOpen = this.selectionModal.classList.contains('active');

    if (isModalOpen) {
      // Handle number keys for selection options
      if (/^[1-9]$/.test(key)) {
        const index = parseInt(key) - 1;
        const options = this.selectionOptions.querySelectorAll('.selection-option');

        if (index >= 0 && index < options.length) {
          // Simulate a click on the corresponding option
          options[index].click();
        }
      } else if (key === 'Escape') {
        // Escape key cancels the selection
        this.cancelSelectionBtn.click();
      }
    } else {
      // Main combat controls
      switch (key) {
        case '1':
        case 'Numpad1':
          // Attack action
          if (!this.attackBtn.disabled) {
            this.attackBtn.click();
          }
          break;
        case '2':
        case 'Numpad2':
          // Cast spell
          if (!this.castBtn.disabled) {
            this.castBtn.click();
          }
          break;
        case '0':
        case 'Numpad0':
          // End turn
          if (!this.endTurnBtn.disabled) {
            this.endTurnBtn.click();
          }
          break;
      }
    }
  }

  updateTurnDisplay(turnData) {
    // Update whose turn it is
    if (this.turnInfoDisplay) {
      const entityName = this.getEntityName(turnData.entityId);
      this.turnInfoDisplay.textContent = `Round ${turnData.round} - ${entityName}'s Turn`;

      // Highlight if it's local player's turn
      if (turnData.isLocalPlayerTurn) {
        this.turnInfoDisplay.classList.add('your-turn');
      } else {
        this.turnInfoDisplay.classList.remove('your-turn');
      }
    }

    // Update turn order display
    this.updateTurnOrderDisplay(turnData.turnOrder, turnData.turnIndex);

    // Reset turn timer
    this.resetTurnTimer();

    // Update UI state based on whose turn it is
    this.updateActionButtons(turnData.isLocalPlayerTurn);
  }

  getEntityName(entityId) {
    const entity = this.combatManager.getEntityById(entityId);
    return entity ? entity.name : 'Unknown';
  }

  updateTurnOrderDisplay(turnOrder, currentIndex) {
    if (!this.turnOrderContainer) return;

    // Clear current content
    this.turnOrderContainer.innerHTML = '';

    // Create turn order list
    const turnList = document.createElement('ul');
    turnList.className = 'turn-order-list';

    turnOrder.forEach((entity, index) => {
      const listItem = document.createElement('li');
      listItem.className = 'turn-order-item';

      // Add classes based on state
      if (index === currentIndex) {
        listItem.classList.add('current-turn');
      }
      if (entity.hasTakenTurn) {
        listItem.classList.add('turn-taken');
      }
      if (entity.id === this.combatManager.socketManager.getSocketId()) {
        listItem.classList.add('local-player');
      }

      // Add initiative value
      const initiativeSpan = document.createElement('span');
      initiativeSpan.className = 'initiative-value';
      initiativeSpan.textContent = entity.initiative;

      // Add entity name
      const nameSpan = document.createElement('span');
      nameSpan.className = 'entity-name';
      nameSpan.textContent = entity.name;

      // Assemble list item
      listItem.appendChild(initiativeSpan);
      listItem.appendChild(nameSpan);
      turnList.appendChild(listItem);
    });

    this.turnOrderContainer.appendChild(turnList);
  }

  resetTurnTimer() {
    this.turnStartTime = Date.now();
    if (this.turnTimerDisplay) {
      this.turnTimerDisplay.textContent = '0.0s';
    }

    // Clear existing timer interval
    if (this.turnTimerInterval) {
      clearInterval(this.turnTimerInterval);
    }

    // Set up new timer interval
    this.turnTimerInterval = setInterval(() => {
      this.updateTurnTimer();
    }, 100);
  }

  updateTurnTimer() {
    if (!this.turnTimerDisplay || !this.turnStartTime) return;

    const elapsed = (Date.now() - this.turnStartTime) / 1000;
    this.turnTimerDisplay.textContent = `${elapsed.toFixed(1)}s`;
  }
}