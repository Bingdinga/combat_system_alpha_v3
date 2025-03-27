// server/Abilities.js

const { v4: uuidv4 } = require('uuid');
const { applyPassiveEffect } = require('./PassiveEffects');

// Base Ability class
class GameAbility {
  constructor(id, name, description, energyCost, targetType, handler) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.energyCost = energyCost || 0;
    this.targetType = targetType; // 'enemy', 'ally', 'self', 'all'
    this.handler = handler; // Function to execute when the ability is used
  }

  // Process the ability use
  execute(combat, actor, target) {
    // Call the handler with necessary context
    return this.handler(combat, actor, target);
  }
}

// Registry of all abilities
const AbilityRegistry = {
  // Basic attack ability
  attack: {
    id: 'attack',
    name: 'Attack',
    description: 'Deal physical damage to an enemy',
    energyCost: 0,
    targetType: 'enemy',
    clientData: {
      id: 'attack',
      name: 'Attack',
      description: 'Deal physical damage to an enemy',
      energyCost: 0,
      targetType: 'enemy',
      type: 'attack'
    }
  },

  // Fireball spell
  fireball: {
    id: 'fireball',
    name: 'Fireball',
    description: 'Cast a damaging fire spell on an enemy',
    energyCost: 20,
    targetType: 'enemy',
    clientData: {
      id: 'fireball',
      name: 'Fireball',
      description: 'Cast a damaging fire spell on an enemy',
      energyCost: 20,
      targetType: 'enemy',
      type: 'cast'
    }
  },

  // Shield spell
  shield: {
    id: 'shield',
    name: 'Shield',
    description: 'Cast a protective spell that increases AC by 5 for 3 rounds',
    energyCost: 20,
    targetType: 'self',
    clientData: {
      id: 'shield',
      name: 'Shield',
      description: 'Cast a protective spell that increases AC by 5 for 3 rounds',
      energyCost: 20,
      targetType: 'self',
      type: 'cast'
    }
  },

  // Healing spell
  heal: {
    id: 'heal',
    name: 'Healing Word',
    description: 'Cast a healing spell that restores health',
    energyCost: 20,
    targetType: 'ally',
    clientData: {
      id: 'heal',
      name: 'Healing Word',
      description: 'Cast a healing spell that restores health',
      energyCost: 20,
      targetType: 'ally',
      type: 'cast'
    }
  },

  // Fighter's Second Wind
  secondWind: {
    id: 'secondWind',
    name: 'Second Wind',
    description: 'Recover hit points equal to 1d10 + your level',
    energyCost: 20,
    targetType: 'self',
    clientData: {
      id: 'secondWind',
      name: 'Second Wind',
      description: 'Recover hit points equal to 1d10 + your level',
      energyCost: 20,
      targetType: 'self',
      type: 'cast'
    }
  },

  divineSmite: {
    id: 'divineSmite',
    name: 'Divine Smite',
    description: 'Channel divine energy to smite your foes with holy power',
    energyCost: 20,
    targetType: 'enemy',
    clientData: {
      id: 'divineSmite',
      name: 'Divine Smite',
      description: 'Channel divine energy to smite your foes with holy power',
      energyCost: 20,
      targetType: 'enemy',
      type: 'cast'
    }
  },

  counterspell: {
    id: 'counterspell',
    name: 'Counterspell',
    description: 'Counter an enemy spell before it takes effect',
    energyCost: 15,
    targetType: 'enemy',
    clientData: {
      id: 'counterspell',
      name: 'Counterspell',
      description: 'Counter an enemy spell before it takes effect',
      energyCost: 15,
      targetType: 'enemy',
      type: 'cast'
    }
  },
  massHeal: {
    id: 'massHeal',
    name: 'Mass Heal',
    description: 'Heal all allies for a small amount',
    energyCost: 30,
    targetType: 'all',
    clientData: {
      id: 'massHeal',
      name: 'Mass Heal',
      description: 'Heal all allies for a small amount',
      energyCost: 30,
      targetType: 'all',
      type: 'cast'
    }
  }

};

// Define handlers for server-side execution
const abilityHandlers = {
  // Basic attack implementation
  attack: function (combat, actor, target) {
    // D20 roll (1-20)
    const d20Roll = Math.floor(Math.random() * 20) + 1;

    // Use strength directly as modifier
    const attackModifier = actor.abilityScores.strength;
    const attackRoll = d20Roll + attackModifier;

    // Target's AC
    const targetAC = target.ac || 10 + target.abilityScores.dexterity;

    // Create base result object with roll details
    const result = {
      details: {
        d20Roll: d20Roll,
        attackModifier: attackModifier,
        totalAttackRoll: attackRoll,
        targetAC: targetAC,
        attackType: 'melee'
      }
    };

    const baseDamage = (10 + attackModifier);

    // Apply passive effects to determine critical hit
    // Check if actor has increaseCritRange passive
    const criticalRoll = applyPassiveEffect(actor, 'modifyAttackRoll', d20Roll, actor);
    const isCritical = criticalRoll.isCritical || d20Roll === 20;

    // Critical hit on natural 20
    if (isCritical) {
      // Calculate critical damage (double dice)
      const damage = Math.floor(baseDamage * 2);
      // Apply damage to target
      target.health = Math.max(0, target.health - damage);

      // Update result with damage details
      result.details.damage = damage;
      result.details.targetHealthBefore = target.health + damage;
      result.details.targetHealthAfter = target.health;
      result.details.isCritical = true;

      result.message = `${actor.name} rolled a natural 20! Critical hit on ${target.name} for ${damage} damage!`;
    }
    // Critical failure on natural 1
    else if (d20Roll === 1) {
      result.details.isCriticalFail = true;
      result.message = `${actor.name} rolled a natural 1! Critical miss against ${target.name}!`;
    }
    // Normal hit/miss logic
    else if (attackRoll >= targetAC) {
      // Calculate normal hit damage
      // const attackModifier = actor.abilityScores.strength;
      const damage = baseDamage;


      // Apply damage to target
      target.health = Math.max(0, target.health - damage);

      // Update result with damage details
      result.details.damage = damage;
      result.details.targetHealthBefore = target.health + damage;
      result.details.targetHealthAfter = target.health;
      result.details.isHit = true;

      result.message = `${actor.name} rolled ${attackRoll} vs AC ${targetAC} and hit ${target.name} for ${damage} damage!`;
    }
    else {
      // Miss
      result.details.isHit = false;
      result.message = `${actor.name} rolled ${attackRoll} vs AC ${targetAC} and missed ${target.name}!`;
    }

    return result;
  },

  // Fireball spell
  fireball: function (combat, actor, target) {
    // Check energy cost
    if (actor.energy < 20) {
      return {
        message: `${actor.name} doesn't have enough energy to cast Fireball!`,
        details: { failed: true }
      };
    }

    // Consume energy
    actor.energy -= 20;

    // Spell attack roll
    const d20Roll = Math.floor(Math.random() * 20) + 1;

    // Use intelligence for wizards, wisdom otherwise
    const spellAbility = 'intelligence';
    const spellAbilityMod = actor.abilityScores[spellAbility];

    // Create base result details
    const result = {
      details: {
        spellType: 'fireball',
        d20Roll: d20Roll,
        spellAttackBonus: spellAbilityMod,
        totalSpellRoll: d20Roll + spellAbilityMod,
        energyCost: 20,
        actorEnergyBefore: actor.energy + 20,
        actorEnergyAfter: actor.energy
      }
    };

    // Roll 2d6 for base damage
    const damageRoll1 = Math.floor(Math.random() * 6) + 1;
    const damageRoll2 = Math.floor(Math.random() * 6) + 1;
    let baseDamage = damageRoll1 + damageRoll2 + spellAbilityMod;

    baseDamage = applyPassiveEffect(actor, 'modifySpellDamage', baseDamage, actor);

    // Critical hit on natural 20
    if (d20Roll === 20) {
      // Double damage on crit
      const damage = baseDamage * 2;

      // Apply damage
      target.health = Math.max(0, target.health - damage);

      // Update result
      result.details.damage = damage;
      result.details.isCritical = true;
      result.details.targetHealthBefore = target.health + damage;
      result.details.targetHealthAfter = target.health;

      result.message = `${actor.name} rolled a natural 20! Critical Fireball hits ${target.name} for ${damage} fire damage!`;
    }
    // Critical failure on natural 1
    else if (d20Roll === 1) {
      result.details.isCriticalFail = true;
      result.message = `${actor.name} rolled a natural 1! The Fireball fizzles out harmlessly!`;
    }
    // Normal case - saving throw
    else {
      // Calculate save DC
      const saveDC = 8 + spellAbilityMod + 2;

      // Target makes Dexterity saving throw
      const targetDexMod = target.abilityScores.dexterity;
      const targetSaveRoll = Math.floor(Math.random() * 20) + 1 + targetDexMod;

      // Roll 2d6 for base damage
      // const damageRoll1 = Math.floor(Math.random() * 6) + 1;
      // const damageRoll2 = Math.floor(Math.random() * 6) + 1;
      // const baseDamage = damageRoll1 + damageRoll2 + spellAbilityMod;
      const damage = baseDamage;

      // Add save details to result
      result.details.saveDC = saveDC;
      result.details.targetSaveRoll = targetSaveRoll;

      // Failed save - full damage
      if (targetSaveRoll < saveDC) {
        // Apply full damage
        target.health = Math.max(0, target.health - damage);

        // Update result
        result.details.damage = damage;
        result.details.saveSuccess = false;
        result.details.targetHealthBefore = target.health + damage;
        result.details.targetHealthAfter = target.health;

        result.message = `${actor.name}'s Fireball hits ${target.name} (DC ${saveDC} vs ${targetSaveRoll}). ${target.name} takes ${damage} fire damage!`;
      }
      // Successful save - half damage
      else {
        // Calculate and apply half damage
        const halfDamage = Math.floor(damage / 2);
        target.health = Math.max(0, target.health - halfDamage);

        // Update result
        result.details.damage = halfDamage;
        result.details.saveSuccess = true;
        result.details.targetHealthBefore = target.health + halfDamage;
        result.details.targetHealthAfter = target.health;

        result.message = `${actor.name} casts Fireball, but ${target.name} partially dodges it (DC ${saveDC} vs ${targetSaveRoll}). ${target.name} takes ${halfDamage} fire damage!`;
      }
    }

    return result;
  },

  // Shield spell
  shield: function (combat, actor, target) {
    // Check energy cost
    if (actor.energy < 20) {
      return {
        message: `${actor.name} doesn't have enough energy to cast Shield!`,
        details: { failed: true }
      };
    }

    // Consume energy
    actor.energy -= 20;

    // Create shield effect
    const shieldBuff = {
      id: uuidv4(),
      type: 'acBuff',
      value: 5,
      duration: 3,
      applied: Date.now()
    };

    // Apply shield effect to actor
    actor.statusEffects.push(shieldBuff);

    return {
      message: `${actor.name} casts Shield, increasing AC by 5 for 3 rounds!`,
      details: {
        spellType: 'shield',
        buffValue: 5,
        buffDuration: 3,
        energyCost: 20,
        actorEnergyBefore: actor.energy + 20,
        actorEnergyAfter: actor.energy
      }
    };
  },

  // Healing Word spell
  heal: function (combat, actor, target) {
    // Check energy cost
    if (actor.energy < 20) {
      return {
        message: `${actor.name} doesn't have enough energy to cast Healing Word!`,
        details: { failed: true }
      };
    }

    // Consume energy
    actor.energy -= 20;

    // Roll 1d4 + wisdom for healing
    const healRoll = Math.floor(Math.random() * 4) + 1;
    const healModifier = actor.abilityScores.wisdom;
    let healAmount = Math.max(1, healRoll + healModifier); // Minimum 1 HP healed
    healAmount = applyPassiveEffect(actor, 'modifyHealAmount', healAmount, actor);

    // Store original health for reporting
    const originalHealth = target.health;

    // Apply healing (capped at max health)
    target.health = Math.min(target.maxHealth, target.health + healAmount);

    // Calculate actual amount healed (could be less if near max health)
    const actualHeal = target.health - originalHealth;

    return {
      message: `${actor.name} casts Healing Word on ${target.name}, restoring ${actualHeal} health!`,
      details: {
        spellType: 'heal',
        healRoll: healRoll,
        healModifier: healModifier,
        healAmount: actualHeal,
        energyCost: 20,
        targetHealthBefore: originalHealth,
        targetHealthAfter: target.health,
        actorEnergyBefore: actor.energy + 20,
        actorEnergyAfter: actor.energy
      }
    };
  },

  // Fighter's Second Wind
  secondWind: function (combat, actor, target) {
    // Check if actor is a fighter
    if (actor.characterClass !== 'FIGHTER') {
      return {
        message: `Only Fighters can use Second Wind!`,
        details: { failed: true }
      };
    }

    // Check energy cost
    if (actor.energy < 20) {
      return {
        message: `${actor.name} doesn't have enough energy to use Second Wind!`,
        details: { failed: true }
      };
    }

    // Consume energy
    actor.energy -= 20;

    // Roll 1d10 + level (assumed to be 1 at this point)
    const healRoll = Math.floor(Math.random() * 10) + 1;
    const level = 1; // Starting level
    const healAmount = healRoll + level;

    // Store original health for reporting
    const originalHealth = actor.health;

    // Apply healing (capped at max health)
    actor.health = Math.min(actor.maxHealth, actor.health + healAmount);

    // Calculate actual amount healed
    const actualHeal = actor.health - originalHealth;

    return {
      message: `${actor.name} uses Second Wind, recovering ${actualHeal} health!`,
      details: {
        spellType: 'secondWind',
        healRoll: healRoll,
        healAmount: actualHeal,
        energyCost: 20,
        actorHealthBefore: originalHealth,
        actorHealthAfter: actor.health,
        actorEnergyBefore: actor.energy + 20,
        actorEnergyAfter: actor.energy
      }
    };
  },

  divineSmite: function (combat, actor, target) {
    // Check energy cost
    if (actor.energy < 20) {
      return {
        message: `${actor.name} doesn't have enough energy to cast Divine Smite!`,
        details: { failed: true }
      };
    }

    // Consume energy
    actor.energy -= 20;

    // Roll damage based on wisdom
    const d8Roll1 = Math.floor(Math.random() * 8) + 1;
    const d8Roll2 = Math.floor(Math.random() * 8) + 1;
    const wisdomMod = actor.abilityScores.wisdom;
    const baseDamage = d8Roll1 + d8Roll2 + wisdomMod;

    // Spell attack roll
    const d20Roll = Math.floor(Math.random() * 20) + 1;
    const attackBonus = wisdomMod;
    const attackRoll = d20Roll + attackBonus;
    const targetAC = target.ac || 10;

    // Create result object
    const result = {
      details: {
        spellType: 'divineSmite',
        d20Roll: d20Roll,
        attackBonus: attackBonus,
        totalAttackRoll: attackRoll,
        targetAC: targetAC,
        energyCost: 20,
        actorEnergyBefore: actor.energy + 20,
        actorEnergyAfter: actor.energy
      }
    };

    // Critical hit on natural 20
    if (d20Roll === 20) {
      const critDamage = baseDamage * 2;
      target.health = Math.max(0, target.health - critDamage);

      result.details.damage = critDamage;
      result.details.isCritical = true;
      result.details.targetHealthBefore = target.health + critDamage;
      result.details.targetHealthAfter = target.health;

      result.message = `${actor.name} rolled a natural 20! Critical Divine Smite hits ${target.name} for ${critDamage} radiant damage!`;
    }
    // Critical failure on natural 1
    else if (d20Roll === 1) {
      result.details.isCriticalFail = true;
      result.message = `${actor.name} rolled a natural 1! The Divine Smite dissipates harmlessly!`;
    }
    // Normal hit/miss
    else if (attackRoll >= targetAC) {
      const damage = baseDamage;
      target.health = Math.max(0, target.health - damage);

      result.details.damage = damage;
      result.details.isHit = true;
      result.details.targetHealthBefore = target.health + damage;
      result.details.targetHealthAfter = target.health;

      result.message = `${actor.name}'s Divine Smite hits ${target.name} for ${damage} radiant damage!`;
    }
    else {
      result.details.isHit = false;
      result.message = `${actor.name} rolled ${attackRoll} vs AC ${targetAC} and missed ${target.name} with Divine Smite!`;
    }

    return result;
  },

  counterspell: function (combat, actor, target) {
    // Check energy cost
    if (actor.energy < 15) {
      return {
        message: `${actor.name} doesn't have enough energy to cast Counterspell!`,
        details: { failed: true }
      };
    }

    // Consume energy
    actor.energy -= 15;

    return {
      message: `${actor.name} casts Counterspell, ready to counter the next enemy spell!`,
      details: {
        spellType: 'counterspell',
        energyCost: 15,
        actorEnergyBefore: actor.energy + 15,
        actorEnergyAfter: actor.energy
      }
    };
  },

  massHeal: function (combat, actor, target) {
    // Check energy cost
    if (actor.energy < 30) {
      return {
        message: `${actor.name} doesn't have enough energy to cast Mass Heal!`,
        details: { failed: true }
      };
    }

    // Consume energy
    actor.energy -= 30;

    // Calculate healing amount (smaller than regular heal but affects all)
    const healRoll = Math.floor(Math.random() * 4) + 1;
    const wisdomMod = actor.abilityScores.wisdom;
    const healAmount = Math.max(1, healRoll + wisdomMod); // Minimum 1 HP healed

    // Get all allies (including self)
    const allies = combat.entities.filter(entity =>
      entity.type === actor.type && entity.health > 0
    );

    // Track total healing done
    let totalHealing = 0;
    const healingDetails = [];

    // Apply healing to each ally
    allies.forEach(ally => {
      const originalHealth = ally.health;
      ally.health = Math.min(ally.maxHealth, ally.health + healAmount);
      const actualHeal = ally.health - originalHealth;

      totalHealing += actualHeal;
      healingDetails.push({
        id: ally.id,
        name: ally.name,
        healAmount: actualHeal,
        healthBefore: originalHealth,
        healthAfter: ally.health
      });
    });

    return {
      message: `${actor.name} casts Mass Heal, restoring ${healAmount} health to all allies!`,
      details: {
        spellType: 'massHeal',
        baseHealAmount: healAmount,
        totalHealing: totalHealing,
        energyCost: 30,
        actorEnergyBefore: actor.energy + 30,
        actorEnergyAfter: actor.energy,
        healingDetails: healingDetails
      }
    };
  }

};

// Get ability by ID
function getAbility(abilityId) {
  return AbilityRegistry[abilityId];
}

// Get all abilities
function getAllAbilities() {
  return Object.values(AbilityRegistry).map(ability => ability.clientData);
}

// Get abilities for a specific class
function getAbilitiesForClass(className) {
  // This maps class names to ability IDs
  const classAbilityMap = {
    FIGHTER: ['attack', 'secondWind'],
    WIZARD: ['attack', 'fireball', 'shield'],
    CLERIC: ['attack', 'heal', 'divineSmite']
  };

  // Return the appropriate abilities or an empty array
  const abilityIds = classAbilityMap[className] || [];
  return abilityIds.map(id => AbilityRegistry[id] ? AbilityRegistry[id].clientData : null).filter(Boolean);
}

// Export functions and data
module.exports = {
  AbilityRegistry,
  abilityHandlers,
  getAbility,
  getAllAbilities,
  getAbilitiesForClass
};