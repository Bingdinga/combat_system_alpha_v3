// server/GameClasses.js
const CharacterClasses = {
    FIGHTER: {
        name: 'Fighter',
        description: 'Masters of martial combat, skilled with a variety of weapons and armor.',
        baseAbilityScores: {
            strength: 5,
            dexterity: 1,
            constitution: 3,
            intelligence: -1,
            wisdom: 0,
            charisma: 0
        },
        baseAC: 17,
        baseHealth: 70,
        abilities: ['attack', 'secondWind'],
        hitDie: 10
    },
    WIZARD: {
        name: 'Wizard',
        description: 'Scholarly magic-users capable of manipulating the structures of reality.',
        baseAbilityScores: {
            strength: -1,
            dexterity: 2,
            constitution: 1,
            intelligence: 5,
            wisdom: 0,
            charisma: 1
        },
        baseAC: 12,
        baseHealth: 40,
        abilities: ['attack', 'fireball', 'shield'],
        hitDie: 6
    },
    CLERIC: {  // Added new class to replace Rogue
        name: 'Cleric',
        description: 'Divine spellcasters who wield healing magic and the power of their deity.',
        baseAbilityScores: {
            strength: 1,
            dexterity: 0,
            constitution: 2,
            intelligence: 0,
            wisdom: 5,
            charisma: 2
        },
        baseAC: 15,
        baseHealth: 60,
        abilities: ['attack', 'heal', 'divineSmite'],
        hitDie: 8
    }
};

const CharacterFeats = {
    // Combat feats
    WEAPON_MASTER: {
        id: 'WEAPON_MASTER',
        name: 'Weapon Master',
        description: 'Extensive training with weapons provides greater combat effectiveness.',
        bonuses: {
            abilityScores: { strength: 1 }
        },
        abilities: [],
        passiveEffects: ['increaseCritRange']
    },
    TOUGH: {
        id: 'TOUGH',
        name: 'Tough',
        description: 'Your health is bolstered beyond normal limits.',
        bonuses: {
            health: 10
        },
        abilities: [],
        passiveEffects: []
    },
    SPELLPOWER: {
        id: 'SPELLPOWER',
        name: 'Spell Power',
        description: 'Your spells are more potent than normal.',
        bonuses: {
            abilityScores: { intelligence: 1, wisdom: 1 }
        },
        abilities: [],
        passiveEffects: ['increasedSpellDamage']
    },
    WAR_CASTER: {
        id: 'WAR_CASTER',
        name: 'War Caster',
        description: 'You have practiced casting spells in the midst of combat.',
        bonuses: {
            abilityScores: { constitution: 1 }
        },
        abilities: ['counterspell'],
        passiveEffects: []
    },
    HEALER: {
        id: 'HEALER',
        name: 'Healer',
        description: 'You are exceptionally skilled at treating wounds.',
        bonuses: {
            abilityScores: { wisdom: 1 }
        },
        abilities: ['massHeal'],
        passiveEffects: ['enhancedHealing']
    }
};

module.exports = { CharacterClasses, CharacterFeats };