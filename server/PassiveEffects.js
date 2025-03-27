const PassiveEffects = {
    increaseCritRange: {
        id: 'increaseCritRange',
        name: 'Increased Critical Range',
        description: 'Critical hits occur on rolls of 19-20 instead of just 20',
        
        // This function modifies the attack logic when checking for critical hits
        modifyAttackRoll: function(roll, attacker) {
            return {
                isCritical: roll >= 19, // Natural 19-20 is a crit
                roll: roll
            };
        }
    },
    
    increasedSpellDamage: {
        id: 'increasedSpellDamage',
        name: 'Increased Spell Damage',
        description: 'Spell damage is increased by 25%',
        
        // This function modifies spell damage calculations
        modifySpellDamage: function(damage, caster) {
            return Math.floor(damage * 1.25); // 25% more damage
        }
    },
    
    enhancedHealing: {
        id: 'enhancedHealing',
        name: 'Enhanced Healing',
        description: 'Healing spells restore 25% more health',
        
        // This function modifies healing amounts
        modifyHealAmount: function(amount, healer) {
            return Math.floor(amount * 1.25); // 25% more healing
        }
    }
};

// Get passive effect by ID
function getPassiveEffect(effectId) {
    return PassiveEffects[effectId];
}

// Check if an entity has a passive effect
function hasPassiveEffect(entity, effectId) {
    if (!entity.feats || !entity.passiveEffects) return false;
    return entity.passiveEffects.includes(effectId);
}

// Apply passive effect to a calculation
function applyPassiveEffect(entity, effectType, value, ...args) {
    if (!entity.passiveEffects) return value;
    
    let result = value;
    
    entity.passiveEffects.forEach(effectId => {
        const effect = PassiveEffects[effectId];
        if (effect && effect[effectType]) {
            result = effect[effectType](result, entity, ...args);
        }
    });
    
    return result;
}

module.exports = {
    PassiveEffects,
    getPassiveEffect,
    hasPassiveEffect,
    applyPassiveEffect
};