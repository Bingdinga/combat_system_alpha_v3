// /public/js/CombatManager/index.js
import { CombatUI } from '../CombatUI/index.js';
import { CombatState } from './CombatState.js';
import { CombatUpdater } from './CombatUpdater.js';
import { socketManager } from '../Network/index.js';
import { createEntity } from '../Entities/index.js';
import { ActionTypes, getAction } from '../Actions/index.js';

export class CombatManager {
    constructor() {
        this.socketManager = socketManager;
        this.state = new CombatState();
        this.updater = new CombatUpdater(this.state);
        this.combatUI = null;

        // Initialize UI
        this.initializeUI();
        // console.log('CombatUI initialized:', this.combatUI);

        // Setup socket event listeners
        this.setupSocketListeners();

        // Start update loop
        this.startUpdateLoop();

        // Add turn management state
        this.currentTurn = {
            entityId: null,
            isLocalPlayerTurn: false,
            round: 1,
            turnStartTime: null,
            turnIndex: 0,
            turnOrder: []
        };
    }

    // Initialize UI
    initializeUI() {
        this.combatUI = new CombatUI(this);
    }

    // Setup socket listeners
    setupSocketListeners() {
        // Combat initiated event
        this.socketManager.on('combatInitiated', (combatState) => {
            // console.log('[CLIENT] Handling combatInitiated event in CombatManager');
            this.initializeCombat(combatState);
        });

        // Combat updated event
        this.socketManager.on('combatUpdated', (combatState) => {
            // console.log('[CLIENT] Handling combatUpdated event in CombatManager');
            this.updateCombatState(combatState);
        });

        // Combat ended event
        this.socketManager.on('combatEnded', (data) => {
            // console.log('[CLIENT] Handling combatEnded event in CombatManager');
            this.endCombat(data);
        });

        // Add turn-related event listeners
        this.socketManager.on('turnChanged', (turnData) => {
            this.handleTurnChanged(turnData);
        });

        this.socketManager.on('turnEnded', (turnData) => {
            this.handleTurnEnded(turnData);
        });

        this.socketManager.on('actionError', (errorData) => {
            // Display error message to user
            alert(errorData.message);
        });
    }

    // Initialize combat with server state
    initializeCombat(combatState) {
        // Initialize state
        this.state.initialize(combatState, this.socketManager.getSocketId());
        // console.log('[CLIENT] Combat state initialized, local player ID:', this.socketManager.getSocketId());

        // Create entity objects
        this.state.entities = this.updater.createEntities(combatState.entities);
        // console.log('[CLIENT] Created entity objects:', this.state.entities.length);

        // Initialize UI
        // console.log('[CLIENT] Initializing CombatUI with combat state');
        this.combatUI.initializeCombat(combatState);
    }

    handleTurnChanged(turnData) {
        // console.log('Turn changed event received:', turnData); // Add debug logging
        // console.log('Local player ID:', this.socketManager.getSocketId()); // Check local player ID

        // Update turn state
        this.currentTurn.entityId = turnData.entityId;
        this.currentTurn.isLocalPlayerTurn = turnData.entityId === this.socketManager.getSocketId();

        // console.log('Is local player turn?', this.currentTurn.isLocalPlayerTurn); // Debug log

        this.currentTurn.round = turnData.round;
        this.currentTurn.turnStartTime = Date.now();
        this.currentTurn.turnIndex = turnData.turnIndex;
        this.currentTurn.turnOrder = turnData.turnOrder;

        // Update UI
        this.combatUI.updateTurnDisplay(this.currentTurn);
        this.combatUI.updateActionButtons(this.currentTurn.isLocalPlayerTurn);

        // Show turn notification
        const entity = this.getEntityById(turnData.entityId);
        if (entity) {
            const message = this.currentTurn.isLocalPlayerTurn ?
                "Your turn!" : `${entity.name}'s turn`;
            this.combatUI.showTurnNotification(message);
        }
    }

    handleTurnEnded(turnData) {
        // Process end of turn
        const entity = this.getEntityById(turnData.entityId);

        if (entity) {
            // Show turn summary
            const actionCount = turnData.actionsTaken.length;
            const turnSeconds = (turnData.turnDuration / 1000).toFixed(1);
            const message = `${entity.name}'s turn ended (${actionCount} actions, ${turnSeconds}s)`;
            this.combatUI.showTurnSummary(message, turnData.actionsTaken);
        }
    }

    // Helper to get entity by ID
    getEntityById(entityId) {
        return this.state.entities.find(e => e.id === entityId);
    }

    // Update combat state from server
    updateCombatState(combatState) {
        // Let updater process the changes
        const newLogEntries = this.updater.updateCombatState(combatState);

        // Update UI for each entity
        this.state.entities.forEach(entity => {
            this.combatUI.updateEntityElement(entity);
        });

        // Process log entries for visual feedback
        if (newLogEntries && newLogEntries.length > 0) {
            this.processLogEntries(newLogEntries);
        }

        // Update action points UI - IMPORTANT: Pass the correct turn information!
        this.combatUI.updateActionPoints();

        // Process any new log entries
        if (newLogEntries && newLogEntries.length > 0) {
            this.combatUI.combatLog.addEntries(newLogEntries);
        }

        // THIS IS THE FIX: Update action buttons with the correct turn information
        // Use the stored turn state instead of setting it to undefined
        this.combatUI.updateActionButtons(this.currentTurn.isLocalPlayerTurn);
    }

    processLogEntries(logEntries) {
        logEntries.forEach(entry => {
            // Still process visual effects (floating text)
            if (entry.action === 'attack') {
                this.processAttackLogEntry(entry);
            }
            else if (entry.action === 'cast' && entry.details) {
                this.processCastLogEntry(entry);
            }

            // Handle defeat messages
            if (entry.type === 'defeat') {
                this.combatUI.showFloatingText(
                    entry.entityId,
                    'Defeated!',
                    'damage'
                );
            }

            // Ensure the entry is added to the combat log
            // This is now handled by the combat log component
        });
    }

    processAttackLogEntry(entry) {
        // Handle critical success
        if (entry.details?.isCritical) {
            this.combatUI.showFloatingText(
                entry.targetId,
                `CRITICAL! -${entry.details.damage}`,
                'damage'
            );
        }
        // Handle critical failure
        else if (entry.details?.isCriticalFail) {
            this.combatUI.showFloatingText(
                entry.actorId,
                `FUMBLE!`,
                'debuff'
            );
        }
        // Handle normal hit
        else if (entry.details?.damage) {
            this.combatUI.showFloatingText(
                entry.targetId,
                `-${entry.details.damage}`,
                'damage'
            );
        }
        // Handle miss
        else if (entry.details?.isHit === false) {
            this.combatUI.showFloatingText(
                entry.targetId,
                `MISS`,
                'debuff'
            );
        }
    }

    processCastLogEntry(entry) {
        switch (entry.details.spellType) {
            case 'fireball':
                this.processFireballEffect(entry);
                break;
            case 'shield':
                this.combatUI.showFloatingText(
                    entry.actorId,
                    `+${entry.details.buffValue} AC`,
                    'buff'
                );
                break;
            case 'heal':
                this.combatUI.showFloatingText(
                    entry.targetId,
                    `+${entry.details.healAmount}`,
                    'heal'
                );
                break;
            case 'secondWind':
                this.combatUI.showFloatingText(
                    entry.actorId,
                    `+${entry.details.healAmount}`,
                    'heal'
                );
                break;
        }
    }

    processFireballEffect(entry) {
        if (entry.details.isCritical) {
            this.combatUI.showFloatingText(
                entry.targetId,
                `CRITICAL! -${entry.details.damage}`,
                'damage'
            );
        } else if (entry.details.isCriticalFail) {
            this.combatUI.showFloatingText(
                entry.actorId,
                `FIZZLE!`,
                'debuff'
            );
        } else if (entry.details.saveSuccess) {
            this.combatUI.showFloatingText(
                entry.targetId,
                `SAVE! -${entry.details.damage}`,
                'damage'
            );
        } else if (entry.details.damage) {
            this.combatUI.showFloatingText(
                entry.targetId,
                `-${entry.details.damage}`,
                'damage'
            );
        }
    }

    // End combat
    endCombat(data) {
        // Set combat inactive
        this.state.active = false;

        // Store result
        this.state.result = data.result;

        // Update final state
        this.updateCombatState(data.combat);

        // Add a brief delay before showing the result screen
        // This allows the final state update to be rendered
        setTimeout(() => {
            // Show results screen
            this.showResultScreen();
        }, 300);
    }

    endTurn() {
        if (!this.state.active || !this.currentTurn.isLocalPlayerTurn) return;

        // Send end turn request to server
        this.socketManager.endTurn();

        // Disable action buttons immediately for better UI feedback
        this.combatUI.updateActionButtons(false);
    }

    // Show results screen
    showResultScreen() {
        // Get result screen elements
        const resultScreen = document.getElementById('result-screen');
        const resultTitle = document.getElementById('result-title');
        const resultMessage = document.getElementById('result-message');
        const combatStats = document.getElementById('combat-stats');
        const returnBtn = document.getElementById('return-btn');

        // Set result title
        resultTitle.textContent = this.state.result === 'victory' ? 'Victory!' : 'Defeat';

        // Set result message
        resultMessage.textContent = this.state.result === 'victory'
            ? 'Congratulations! All enemies have been defeated.'
            : 'Your party has been defeated. Better luck next time!';

        // Calculate and display stats
        const combatDuration = Math.floor((Date.now() - this.state.startTime) / 1000);
        const minutes = Math.floor(combatDuration / 60);
        const seconds = combatDuration % 60;

        const playerEntities = this.state.entities.filter(e => e.type === 'player');
        const enemyEntities = this.state.entities.filter(e => e.type === 'enemy');

        // Check if entities are alive
        const survivingPlayers = playerEntities.filter(e => {
            const isAlive = typeof e.isAlive === 'function'
                ? e.isAlive()
                : (e.health > 0);
            return isAlive;
        }).length;

        const totalPlayers = playerEntities.length;

        const defeatedEnemies = enemyEntities.filter(e => {
            const isAlive = typeof e.isAlive === 'function'
                ? e.isAlive()
                : (e.health > 0);
            return !isAlive;
        }).length;

        const totalEnemies = enemyEntities.length;

        combatStats.innerHTML = `
      <p>Combat Duration: ${minutes}m ${seconds}s</p>
      <p>Surviving Players: ${survivingPlayers}/${totalPlayers}</p>
      <p>Enemies Defeated: ${defeatedEnemies}/${totalEnemies}</p>
    `;

        // Setup return button
        returnBtn.onclick = () => {
            // Hide result screen
            resultScreen.classList.remove('active');

            // Show room screen
            document.getElementById('room-screen').classList.add('active');

            // Reset combat data
            this.state.reset();
        };

        // Show result screen
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        resultScreen.classList.add('active');
    }

    selectTarget(entityId) {
        // console.log('CombatManager.selectTarget called with entityId:', entityId);

        // If we're clicking the already selected target, deselect it
        if (this.state.selectedTargetId === entityId) {
            // console.log('Deselecting current target');
            this.state.clearSelectedTarget();
        } else {
            // Otherwise, select the new target
            // console.log('Selecting new target:', entityId);
            this.state.setSelectedTarget(entityId);
        }

        // Update the UI to show the selected entity
        if (this.combatUI) {
            this.combatUI.updateSelectedEntity(this.state.selectedTargetId);
        } else {
            console.error('combatUI is undefined');
        }
    }

    // Perform an action
    performAction(actionType, targetId) {
        if (!this.state.active) return;

        // Get local player
        const localPlayer = this.getLocalPlayer();
        if (!localPlayer) return;

        // Check if it's the local player's turn
        if (!this.currentTurn.isLocalPlayerTurn) {
            alert("It's not your turn!");
            return;
        }

        // Only allow actions with a full action point available
        if (localPlayer.actionPoints < 1) {
            console.log("Not enough action points:", localPlayer.actionPoints);
            return;
        }

        // Check if action is on cooldown
        if (this.state.actionCooldown) {
            console.log("Action is on cooldown - preventing rapid clicks");
            return;
        }

        // If no targetId is provided, use the selected target if it exists
        if (!targetId && this.state.selectedTargetId) {
            targetId = this.state.selectedTargetId;
        }

        // If we still don't have a targetId, prompt for target selection
        if (!targetId) {
            this.promptForTargetSelection(actionType);
            return;
        }

        // Set a cooldown to prevent rapid clicking
        this.state.setActionCooldown(true, 300);

        // Send action to server
        this.socketManager.performAction({
            type: actionType.startsWith('cast:') ? 'cast' : actionType,
            spellType: actionType.startsWith('cast:') ? actionType.split(':')[1] : undefined,
            targetId: targetId
        });

        // Apply a temporary optimistic update for better UI feedback
        // This will be overridden by the next server update
        // const originalPoints = localPlayer.actionPoints;
        localPlayer.actionPoints = Math.max(0, localPlayer.actionPoints - 1);

        // Update UI
        this.combatUI.updateActionPoints();
    }

    promptForTargetSelection(actionType) {
        const localPlayer = this.getLocalPlayer();

        if (actionType.startsWith('cast:')) {
            const spellId = actionType.split(':')[1];
            const action = this.getAction(spellId);

            if (action && action.targetType === 'self') {
                // Self-targeted spells don't need target selection
                this.performAction(actionType, localPlayer.id);
                return;
            }
        }

        // For other actions, show the target selection modal
        if (actionType === ActionTypes.ATTACK) {
            this.combatUI.eventHandlers.selectTarget(ActionTypes.ATTACK, this.getEntities(), target => {
                this.performAction(ActionTypes.ATTACK, target.id);
            });
        } else if (actionType.startsWith('cast:')) {
            const spellId = actionType.split(':')[1];
            this.combatUI.eventHandlers.selectTarget(spellId, this.getEntities(), target => {
                this.performAction(actionType, target.id);
            });
        }
    }

    // Add this helper method to get an action 
    getAction(actionId) {
        return getAction(actionId); // Use the imported getAction function
    }

    // Proxy methods that delegate to state
    getLocalPlayer() {
        return this.state.getLocalPlayer();
    }

    isLocalPlayer(entityId) {
        return this.state.isLocalPlayer(entityId);
    }

    getEntities() {
        return this.state.getEntities();
    }

    getCombatDuration() {
        return this.state.getCombatDuration();
    }

    // Update loop for client-side predictions
    startUpdateLoop() {
        setInterval(() => {
            if (!this.state.active) return;

            // Only update the combat timer
            const duration = this.getCombatDuration();
            this.combatUI.updateCombatTimer(duration);
        }, 100);
    }
}