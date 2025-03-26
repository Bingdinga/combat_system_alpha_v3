const { v4: uuidv4 } = require('uuid');
const { CharacterClasses } = require('./GameClasses');
const { getAbility, abilityHandlers } = require('./Abilities');

class CombatManager {
  constructor(io, roomManager) {
    this.io = io;
    this.roomManager = roomManager;
    this.combats = new Map(); // roomId -> combatState

    // Start NPC AI processing loop
    // setInterval(() => this.processNpcAi(), 1000);
  }

  // Initialize a new combat for a room
  initiateCombat(roomId) {
    console.log(`[SERVER] Attempt to initiate combat in room ${roomId}`);

    // Check if room exists and is not already in combat
    if (this.roomManager.isRoomInCombat(roomId)) {
      return;
    }

    // Get players in the room
    const players = this.roomManager.getPlayersInRoom(roomId);
    if (players.length === 0) {
      return;
    }
    console.log(`[SERVER] Players in room ${roomId}:`, players);

    // Set up player entities from room players with character classes
    const playerEntities = players.map(player => {
      // Get class template and create base entity
      const classTemplate = CharacterClasses[player.characterClass] || {
        name: 'Adventurer',
        baseAbilityScores: {
          strength: 0,
          dexterity: 0,
          constitution: 0,
          intelligence: 0,
          wisdom: 0
        },
        baseAC: 10,
        abilities: []
      };

      // Use ability scores directly as modifiers
      const strMod = classTemplate.baseAbilityScores.strength;
      const dexMod = classTemplate.baseAbilityScores.dexterity;
      const conMod = classTemplate.baseAbilityScores.constitution;
      const intMod = classTemplate.baseAbilityScores.intelligence;
      const wisMod = classTemplate.baseAbilityScores.wisdom;

      // Set base HP according to class with the new values
      let baseHP = 50; // Default
      if (player.characterClass === 'FIGHTER') baseHP = 70;
      else if (player.characterClass === 'WIZARD') baseHP = 40;
      else if (player.characterClass === 'ROGUE') baseHP = 50;

      // Add constitution directly to base HP
      const maxHealth = baseHP + conMod;

      return {
        id: player.id,
        name: player.username,
        type: 'player',
        characterClass: player.characterClass,
        health: maxHealth,
        maxHealth: maxHealth,
        energy: 100,
        maxEnergy: 100,
        actionPoints: 3.0,
        maxActionPoints: 3,
        actionTimer: 0,
        actionRechargeRate: 5000, // 5 seconds per action point
        lastActionTime: Date.now(),
        abilityScores: { ...classTemplate.baseAbilityScores },
        ac: classTemplate.baseAC,
        statusEffects: []
      };
    });

    // Generate enemies based on number of players
    const enemies = this.generateEnemies(players.length);

    // Roll initiative for all entities
    const entitiesWithInitiative = [...playerEntities, ...enemies].map(entity => {
      // Calculate initiative: d20 + dexterity modifier
      const initiativeRoll = Math.floor(Math.random() * 20) + 1;
      const dexModifier = entity.abilityScores.dexterity;
      const initiative = initiativeRoll + dexModifier;

      return {
        ...entity,
        initiative: initiative,
        initiativeRoll: initiativeRoll, // Store original roll for display/tiebreakers
        actionPoints: entity.maxActionPoints, // Start with full action points
        hasTakenTurn: false,
      };
    });

    // Create combat state
    const combatState = {
      id: uuidv4(),
      roomId: roomId,
      startTime: Date.now(),
      entities: entitiesWithInitiative,
      log: [{
        time: Date.now(),
        message: 'Combat has begun!'
      }],
      active: true,
      currentTurn: 0, // Index of entity whose turn it is
      round: 1, // Combat round counter
      turnStartTime: Date.now(), // When the current turn started
    };

    // Store combat state
    this.combats.set(roomId, combatState);

    console.log(`[SERVER] Combat state created and stored for room ${roomId}`);

    // Mark room as in combat
    this.roomManager.setRoomCombatStatus(roomId, true);

    // Notify all players in the room
    this.io.to(roomId).emit('combatInitiated', combatState);
    console.log(`[SERVER] combatInitiated event emitted to room ${roomId}`);

    // Start the first turn
    this.startNextTurn(combatState);

    console.log(`Combat initiated in room ${roomId}`);
    return combatState;
  }

  // New method to start the next turn
  startNextTurn(combat) {
    if (!combat.active) return;

    // If we've gone through all entities, start a new round
    if (combat.currentTurn >= combat.entities.length) {
      combat.round++;
      combat.currentTurn = 0;

      // Reset hasTakenTurn flag for the new round
      combat.entities.forEach(entity => {
        entity.hasTakenTurn = false;
      });

      // Log new round
      combat.log.push({
        time: Date.now(),
        message: `Round ${combat.round} begins!`,
        type: 'round'
      });
    }

    // Get the entity whose turn it is
    const currentEntity = combat.entities[combat.currentTurn];

    // Skip dead entities
    if (currentEntity.health <= 0) {
      combat.currentTurn++;
      this.startNextTurn(combat);
      return;
    }

    // Reset turn data
    currentEntity.hasTakenTurn = true;
    currentEntity.turnStartTime = Date.now();
    currentEntity.actionsTaken = [];

    // Refresh action points at the start of turn
    currentEntity.actionPoints = currentEntity.maxActionPoints;

    // Log turn start
    combat.log.push({
      time: Date.now(),
      message: `${currentEntity.name}'s turn begins!`,
      type: 'turn',
      entityId: currentEntity.id,
      entityType: currentEntity.type
    });

    // Update turn start time
    combat.turnStartTime = Date.now();

    // Notify clients about turn change
    this.io.to(combat.roomId).emit('turnChanged', {
      entityId: currentEntity.id,
      entityType: currentEntity.type,
      round: combat.round,
      turnIndex: combat.currentTurn,
      turnOrder: combat.entities.map(e => ({
        id: e.id,
        name: e.name,
        type: e.type,
        initiative: e.initiative,
        hasTakenTurn: e.hasTakenTurn
      }))
    });

    // Send updated combat state
    this.io.to(combat.roomId).emit('combatUpdated', combat);

    // If it's an enemy's turn, process it automatically after a short delay
    if (currentEntity.type === 'enemy') {
      setTimeout(() => {
        this.processNpcTurn(combat, currentEntity);
      }, 1000); // 1 second delay before NPC acts
    }
  }

  // Process enemy turn
  processNpcTurn(combat, enemy) {
    if (!combat.active || enemy.health <= 0) return;

    // Select a target - priority to lower health players
    const players = combat.entities.filter(e => e.type === 'player' && e.health > 0);

    if (players.length === 0) {
      this.endTurn(combat);
      return;
    }

    // Sort players by health (ascending)
    players.sort((a, b) => a.health - b.health);

    // Choose the first (lowest health) player as target
    const target = players[0];

    // Perform attack action
    const actionData = {
      type: 'attack',
      targetId: target.id
    };

    const result = this.processAction(combat, enemy, actionData);

    if (result) {
      // Add log entry
      combat.log.push({
        time: Date.now(),
        actor: result.actorName,
        actorId: result.actorId,
        actorType: 'enemy',
        action: 'attack',
        target: result.targetName,
        targetId: result.targetId,
        message: result.message,
        details: result.details,
        timeSinceTurnStart: Date.now() - combat.turnStartTime
      });

      // Record the action in the enemy's actions taken this turn
      enemy.actionsTaken = enemy.actionsTaken || [];
      enemy.actionsTaken.push({
        type: 'attack',
        targetId: target.id,
        timestamp: Date.now(),
        timeSinceTurnStart: Date.now() - combat.turnStartTime
      });

      // Consume action points
      enemy.actionPoints--;

      // Check combat end conditions
      if (this.checkCombatEnd(combat)) return;

      // Send updated combat state
      this.io.to(combat.roomId).emit('combatUpdated', combat);
    }

    // Wait a bit, then check if the NPC should continue or end turn
    setTimeout(() => {
      // If NPC has remaining action points and combat is active, it might act again
      if (enemy.actionPoints > 0 && combat.active && enemy.health > 0) {
        // 70% chance to act again if possible
        if (Math.random() < 0.7) {
          this.processNpcTurn(combat, enemy);
          return;
        }
      }

      // Otherwise, end the turn
      this.endTurn(combat);
    }, 1500); // 1.5 second delay between actions
  }

  // Add a new method for ending a turn
  endTurn(combat) {
    if (!combat.active) return;

    const currentEntity = combat.entities[combat.currentTurn];
    const turnDuration = Date.now() - combat.turnStartTime;

    // Add turn summary to log
    combat.log.push({
      time: Date.now(),
      message: `${currentEntity.name}'s turn ends (${(turnDuration / 1000).toFixed(1)}s)`,
      type: 'turnEnd',
      entityId: currentEntity.id,
      entityType: currentEntity.type,
      turnDuration: turnDuration,
      actionsTaken: currentEntity.actionsTaken || []
    });

    // Move to the next entity
    combat.currentTurn++;

    // Send turn end notification
    this.io.to(combat.roomId).emit('turnEnded', {
      entityId: currentEntity.id,
      entityType: currentEntity.type,
      turnDuration: turnDuration,
      actionsTaken: currentEntity.actionsTaken || []
    });

    // Start the next turn
    this.startNextTurn(combat);
  }

  // Generate enemy entities based on player count
  generateEnemies(playerCount) {
    // Change this line to make enemyCount equal to playerCount
    const enemyCount = playerCount; // Previously: Math.max(1, Math.floor(playerCount * 1.5));
    const enemies = [];

    const enemyRechargeMult = 3;

    const enemyTypes = [
      {
        name: 'Goblin',
        health: 30,
        actionRechargeRate: 7000 * enemyRechargeMult,
        abilityScores: {
          strength: 3,
          dexterity: 2,
          constitution: 2,
          intelligence: -1,
          wisdom: -1
        },
        ac: 11 // Base AC for goblin
      },
      {
        name: 'Orc',
        health: 50,
        actionRechargeRate: 9000 * enemyRechargeMult,
        abilityScores: {
          strength: 3,
          dexterity: 2,
          constitution: 3,
          intelligence: -1,
          wisdom: 0
        },
        ac: 13 // Base AC for orc 
      },
      {
        name: 'Troll',
        health: 70,
        actionRechargeRate: 13000 * enemyRechargeMult,
        abilityScores: {
          strength: 5,
          dexterity: -1,
          constitution: 7,
          intelligence: -1,
          wisdom: -1
        },
        ac: 15 // Base AC for troll
      }
    ];

    for (let i = 0; i < enemyCount; i++) {
      const enemyType = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
      enemies.push({
        id: `enemy-${uuidv4()}`,
        name: `${enemyType.name} ${i + 1}`,
        type: 'enemy',
        health: enemyType.health,
        maxHealth: enemyType.health,
        energy: 100,
        maxEnergy: 100,
        // Change the max action points to 2 instead of 3
        actionPoints: 2,
        maxActionPoints: 2,  // Changed from 3 to 2
        actionTimer: 0,
        actionRechargeRate: enemyType.actionRechargeRate,
        lastActionTime: Date.now(),
        abilityScores: enemyType.abilityScores,
        ac: enemyType.ac,
        statusEffects: []
      });
    }

    return enemies;
  }

  // Modify handlePlayerAction to work with the turn-based system
  handlePlayerAction(socketId, actionData) {
    // Get room ID and combat state
    const roomId = this.roomManager.getSocketRoom(socketId);
    if (!roomId) return;

    const combat = this.combats.get(roomId);
    if (!combat || !combat.active) return;

    // Find the player entity
    const playerEntity = combat.entities.find(entity => entity.id === socketId);
    if (!playerEntity) return;

    // Check if it's the player's turn
    const currentEntity = combat.entities[combat.currentTurn];
    if (currentEntity.id !== socketId) {
      // It's not this player's turn - send error
      this.io.to(socketId).emit('actionError', {
        message: "It's not your turn!"
      });
      return;
    }

    // Check if player has enough action points
    if (playerEntity.actionPoints < 1) {
      this.io.to(socketId).emit('actionError', {
        message: "Not enough action points!"
      });
      return;
    }

    // Process the action
    const result = this.processAction(combat, playerEntity, actionData);
    if (!result) return;

    // Consume action point
    playerEntity.actionPoints--;

    // Track action in the player's actions this turn
    playerEntity.actionsTaken = playerEntity.actionsTaken || [];
    playerEntity.actionsTaken.push({
      type: actionData.type,
      targetId: actionData.targetId,
      timestamp: Date.now(),
      timeSinceTurnStart: Date.now() - combat.turnStartTime
    });

    // Add detailed log entry with turn timing
    combat.log.push({
      time: Date.now(),
      actor: result.actorName,
      actorId: result.actorId,
      actorType: 'player',
      action: actionData.type,
      target: result.targetName,
      targetId: result.targetId,
      message: result.message,
      details: result.details,
      timeSinceTurnStart: Date.now() - combat.turnStartTime
    });

    // Check for combat end conditions
    this.checkCombatEnd(combat);

    // Send updated combat state
    this.io.to(roomId).emit('combatUpdated', combat);
  }

  // New method to handle end turn request from player
  handleEndTurn(socketId) {
    const roomId = this.roomManager.getSocketRoom(socketId);
    if (!roomId) return;

    const combat = this.combats.get(roomId);
    if (!combat || !combat.active) return;

    // Check if it's really this player's turn
    const currentEntity = combat.entities[combat.currentTurn];
    if (currentEntity.id !== socketId) {
      return; // Not this player's turn
    }

    // End the turn
    this.endTurn(combat);
  }

  // Process an action (attack, defend, cast spell)
  processAction(combat, actor, actionData) {
    // Find target entity
    const target = combat.entities.find(entity => entity.id === actionData.targetId);
    if (!target) return null;

    // Create base result object
    let result = {
      actorId: actor.id,
      targetId: target.id,
      actorName: actor.name,
      targetName: target.name,
      actionType: actionData.type,
      message: '',
      details: {}
    };

    // Determine which ability to use
    const abilityId = actionData.type === 'cast' ? actionData.spellType : actionData.type;

    // Get the ability handler directly from abilityHandlers
    const handler = abilityHandlers[abilityId];
    if (!handler) {
      console.log(`No handler found for ability: ${abilityId}`);
      return null;
    }

    // Execute the ability handler directly
    const abilityResult = handler(combat, actor, target);

    // Update result with ability results
    result.message = abilityResult.message;
    result.details = {
      ...result.details,
      ...abilityResult.details
    };

    // Check if target was defeated
    if (target.health === 0 && target.health < result.details.targetHealthBefore) {
      combat.log.push({
        time: Date.now(),
        message: `${target.name} has been defeated!`,
        type: 'defeat',
        entityId: target.id,
        entityType: target.type
      });
    }

    return result;
  }

  // NPC AI processing loop
  processNpcAi() {
    // Process each active combat
    console.log("[SERVER] Running NPC AI processing");
    for (const [roomId, combat] of this.combats.entries()) {
      if (!combat.active) continue;

      let updated = false;

      // Update action points for all entities
      const now = Date.now();
      combat.entities.forEach(entity => {
        // Calculate time since last action
        const timeSinceLastAction = now - entity.lastActionTime;

        // Calculate accumulated action points 
        const newActionPoints = entity.actionPoints + (timeSinceLastAction / entity.actionRechargeRate);

        // Update action points, capped at max
        const previousActionPoints = entity.actionPoints;
        entity.actionPoints = Math.min(entity.maxActionPoints, newActionPoints);

        // Update last action time if action points changed
        if (entity.actionPoints !== previousActionPoints) {
          entity.lastActionTime = now - (timeSinceLastAction % entity.actionRechargeRate);
          updated = true;
        }

        // Process status effect durations
        entity.statusEffects = entity.statusEffects.filter(effect => {
          // Keep effects that still have duration left
          return effect.duration > 0;
        });
      });

      // Process NPC actions
      const enemies = combat.entities.filter(entity => entity.type === 'enemy' && entity.health > 0);
      const players = combat.entities.filter(entity => entity.type === 'player' && entity.health > 0);

      // Skip if no valid targets
      if (players.length === 0 || enemies.length === 0) {
        this.checkCombatEnd(combat);
        continue;
      }

      // Process each enemy
      enemies.forEach(enemy => {
        // Skip if no action points
        if (enemy.actionPoints < 1) return;

        // Select a random player as target
        const randomPlayer = players[Math.floor(Math.random() * players.length)];

        // Perform attack
        const actionData = {
          type: 'attack',
          targetId: randomPlayer.id
        };

        const result = this.processAction(combat, enemy, actionData);
        if (result) {
          // Use an action point
          enemy.actionPoints -= 1;
          enemy.lastActionTime = now;

          // Add detailed log entry
          combat.log.push({
            time: now,
            actor: result.actorName,
            actorId: result.actorId,
            actorType: 'enemy',
            action: 'attack',
            target: result.targetName,
            targetId: result.targetId,
            message: result.message,
            details: result.details
          });

          updated = true;
        }
      });

      // Check combat end conditions
      this.checkCombatEnd(combat);

      // Send updates if needed
      if (updated && combat.active) {
        this.io.to(roomId).emit('combatUpdated', combat);
      }
    }
  }

  // Check if combat has ended
  checkCombatEnd(combat) {
    // Get alive players and enemies
    const alivePlayers = combat.entities.filter(e => e.type === 'player' && e.health > 0);
    const aliveEnemies = combat.entities.filter(e => e.type === 'enemy' && e.health > 0);
    let shouldEndCombat = false;
    let result = '';

    if (alivePlayers.length === 0) {
      // Players lost
      result = 'defeat';
      shouldEndCombat = true;
    } else if (aliveEnemies.length === 0) {
      // Players won
      result = 'victory';
      shouldEndCombat = true;
    }

    if (shouldEndCombat) {
      // Send a final state update before ending combat
      this.io.to(combat.roomId).emit('combatUpdated', combat);

      // Add a small delay before actually ending the combat
      // This gives clients time to process the final state
      setTimeout(() => {
        this.endCombat(combat, result);
      }, 500); // 500ms delay should be sufficient

      return true;
    }

    return false;
  }

  // End combat with result
  endCombat(combat, result) {
    if (!combat.active) return;

    // Set combat inactive
    combat.active = false;
    combat.endTime = Date.now();
    combat.result = result;

    // Add log entry
    combat.log.push({
      time: Date.now(),
      message: result === 'victory' ? 'Victory! All enemies have been defeated!' : 'Defeat! All players have fallen!'
    });

    // Set room combat status
    this.roomManager.setRoomCombatStatus(combat.roomId, false);

    // Notify players
    this.io.to(combat.roomId).emit('combatEnded', {
      result: result,
      combat: combat
    });

    console.log(`Combat ended in room ${combat.roomId} with ${result}`);

    // Clean up combat after a delay
    setTimeout(() => {
      this.combats.delete(combat.roomId);
    }, 60000); // Keep combat data for 1 minute for post-combat review
  }
}

module.exports = CombatManager;