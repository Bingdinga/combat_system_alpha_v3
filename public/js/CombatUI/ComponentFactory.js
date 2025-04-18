// /public/js/CombatUI/ComponentFactory.js

export class ComponentFactory {
  constructor(combatManager) {
    this.combatManager = combatManager;
  }

  createEntityNameRow(entity) {
    const isLocalPlayer = this.combatManager.isLocalPlayer(entity.id);

    // Create the name row with character class
    const nameRow = document.createElement('div');
    nameRow.className = 'entity-name-row';

    // Create name span
    const nameSpan = document.createElement('span');
    nameSpan.className = 'entity-name';
    nameSpan.textContent = `${entity.name}${isLocalPlayer ? ' (You)' : ''}`;
    nameRow.appendChild(nameSpan);

    // Add class display if available
    if (entity.characterClass) {
      const classSpan = document.createElement('span');
      classSpan.className = 'entity-class';
      classSpan.textContent = this.formatClassName(entity.characterClass);
      nameRow.appendChild(classSpan);
    }

    return nameRow;
  }

  formatClassName(className) {
    return className.charAt(0) + className.slice(1).toLowerCase();
  }

  createEntityStatsArea(entity) {
    const statsDiv = document.createElement('div');
    statsDiv.className = 'entity-stats';

    // Create health and AC row
    const statRowDiv = document.createElement('div');
    statRowDiv.className = 'entity-stat-row';
    statRowDiv.innerHTML = `
          <div class="entity-hp">HP: ${entity.health}/${entity.maxHealth}</div>
          <div class="entity-ac">AC: ${entity.ac || 10}</div>
      `;
    statsDiv.appendChild(statRowDiv);

    // Add health bar
    const healthPercentage = entity.getHealthPercentage?.() || (entity.health / entity.maxHealth * 100);
    const energyPercentage = entity.getEnergyPercentage?.() || (entity.energy / entity.maxEnergy * 100);

    statsDiv.innerHTML += `
          <div class="health-bar-container">
              <div class="health-bar" style="width: ${healthPercentage}%"></div>
          </div>
          <div class="entity-energy">
              <div>Energy: ${entity.energy}/${entity.maxEnergy}</div>
              <div class="energy-bar-container">
                  <div class="energy-bar" style="width: ${energyPercentage}%"></div>
              </div>
          </div>
      `;

    return statsDiv;
  }

  createEntityActionPoints(entity) {
    const actionPointsDiv = document.createElement('div');
    actionPointsDiv.className = 'entity-action-points';

    // Simplified to just show current and max action points as text
    const apText = document.createElement('div');
    apText.className = 'entity-action-points-text';
    apText.textContent = `AP: ${Math.floor(entity.actionPoints)}/${entity.maxActionPoints}`;
    actionPointsDiv.appendChild(apText);

    return actionPointsDiv;
  }

  createStatusEffectsElement(entity) {
    const statusEffectsEl = document.createElement('div');
    statusEffectsEl.className = 'status-effects';

    entity.statusEffects.forEach(effect => {
      const effectEl = document.createElement('span');
      effectEl.className = this.getStatusEffectClass(effect.type);
      effectEl.textContent = this.formatStatusEffectName(effect.type);
      statusEffectsEl.appendChild(effectEl);
    });

    return statusEffectsEl;
  }

  getStatusEffectClass(effectType) {
    const registry = window.StatusEffectRegistry;
    if (registry?.[effectType]) {
      return `status-effect ${registry[effectType].cssClass}`;
    }

    // Fallback
    return `status-effect ${effectType.includes('Buff') ? 'buff' : 'debuff'}`;
  }

  formatStatusEffectName(effectType) {
    // Check registry first
    if (window.StatusEffectRegistry?.[effectType]) {
      return window.StatusEffectRegistry[effectType].displayName;
    }

    // Simple formatting fallback
    let name = effectType.replace(/Buff|Debuff/g, '');
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  createAbilityOption(ability, player, onSelect, index) {
    const optionEl = document.createElement('div');
    optionEl.className = 'selection-option';
    optionEl.setAttribute('data-option-id', ability.id);

    // Create container for name that will include the number indicator
    const nameContainer = document.createElement('div');
    nameContainer.className = 'option-name';

    // Add number indicator if index is provided
    if (typeof index === 'number') {
      const numberIndicator = document.createElement('span');
      numberIndicator.className = 'number-indicator';
      numberIndicator.textContent = `${index + 1}. `;
      nameContainer.appendChild(numberIndicator);
    }

    // Add ability name to the name container
    const nameText = document.createElement('span');
    nameText.textContent = ability.name;
    nameContainer.appendChild(nameText);

    // Create description element
    const descEl = document.createElement('div');
    descEl.className = 'option-description';
    descEl.textContent = ability.description;

    // Add elements to option
    optionEl.appendChild(nameContainer);
    optionEl.appendChild(descEl);

    // Add click handler
    optionEl.addEventListener('click', () => onSelect(ability));

    return optionEl;
  }
}