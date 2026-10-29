// Loot: rolling drops after fights, item stats, and equipping gear.
// Tiers, item names and drop chances live in data/loot.json.

let lootTable = null;  // loaded from data/loot.json by main.js

const LEVEL_STAT_BONUS = 0.1;  // each item level above 1 adds 10% to its stat

function tierById(id) {
  return lootTable.tiers.find(tier => tier.id === id);
}

// 0 for Common up to 4 for Legendary, so tiers can be compared
function tierRank(tierId) {
  return lootTable.tiers.findIndex(tier => tier.id === tierId);
}

function slotById(id) {
  return lootTable.slots.find(slot => slot.id === id);
}

function randomFrom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

// ---------------------------------------------------------------
// Rolling a drop
// ---------------------------------------------------------------

// Weighted random pick: a tier with weight 50 is 50 times as likely as
// one with weight 1. Hard mode multiplies the weights of the rare tiers.
function rollTier() {
  const rareBonus = currentMode === MODES.hard ? lootTable.hardModeRareBonus : 1;
  const weights = lootTable.tiers.map(tier => tier.weight * (tier.rare ? rareBonus : 1));
  const total = weights.reduce((sum, weight) => sum + weight, 0);

  let roll = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    if (roll < weights[i]) {
      return lootTable.tiers[i];
    }
    roll -= weights[i];
  }
  return lootTable.tiers[lootTable.tiers.length - 1];
}

function makeItem(tier, zoneLevel) {
  const isLegendary = tier.id === "legendary";
  const base = randomFrom(isLegendary ? lootTable.legendaries : lootTable.bases);
  const slot = slotById(base.slot);
  const level = zoneLevel + tier.levelOffset;  // rarer gear needs a higher level

  return {
    id: save.nextItemId++,
    name: isLegendary ? base.name : tier.name + " " + base.name,
    tier: tier.id,
    slot: base.slot,
    icon: base.icon,
    stat: slot.stat,
    value: Math.round(tier.stats[slot.stat] * (1 + (level - 1) * LEVEL_STAT_BONUS)),
    level: level,
    effect: base.effect || null,
    effectText: base.effectText || null
  };
}

// Called after winning a fight. Returns { item, kept } or null if nothing dropped.
function rollDrop() {
  let chance = enemy.boss ? lootTable.bossDropChance : lootTable.dropChance;
  chance += treeBonus("loot") / 100;  // e.g. Vendor Assessment: +3% per point
  if (hasKeystone("accept-the-risk")) {
    chance += ACCEPT_RISK_LOOT;
  }
  if (Math.random() >= chance) {
    return null;
  }

  // Bosses roll twice and keep the better result
  let tier = rollTier();
  if (enemy.boss) {
    const secondTry = rollTier();
    if (tierRank(secondTry.id) > tierRank(tier.id)) {
      tier = secondTry;
    }
  }

  const item = makeItem(tier, currentZone.level || 1);
  const kept = save.inventory.length < lootTable.inventoryLimit;
  if (kept) {
    save.inventory.push(item);
  }
  writeSave();
  return { item: item, kept: kept };
}

// ---------------------------------------------------------------
// Equipped gear and its bonuses
// ---------------------------------------------------------------

function findItem(itemId) {
  return save.inventory.find(item => item.id === itemId);
}

// Equipped items that actually work: gear above your level does nothing
// (this matters after switching class costs you levels)
function activeGear() {
  return Object.values(save.equipped)
    .map(itemId => findItem(itemId))
    .filter(item => item !== undefined && item.level <= save.level);
}

// Total bonus for one stat ("damage", "hp" or "time") from active gear
function gearBonus(stat) {
  return activeGear()
    .filter(item => item.stat === stat)
    .reduce((sum, item) => sum + item.value, 0);
}

function hasEffect(effect) {
  return activeGear().some(item => item.effect === effect);
}

function isEquipped(item) {
  return save.equipped[item.slot] === item.id;
}

// Equip an item, replacing whatever was in its slot. Returns false if
// your level is too low. Used by the Gear screen and the after-battle button.
function equipItem(item) {
  if (item.level > save.level) {
    return false;  // the buttons are disabled too, but never trust the button alone
  }
  save.equipped[item.slot] = item.id;
  writeSave();
  return true;
}

function equip(item) {
  equipItem(item);
  showGear();
}

function unequip(item) {
  save.equipped[item.slot] = null;
  writeSave();
  showGear();
}

function discard(item) {
  if (!confirm("Discard " + item.name + "? This can't be undone.")) {
    return;
  }
  if (isEquipped(item)) {
    save.equipped[item.slot] = null;
  }
  save.inventory = save.inventory.filter(other => other.id !== item.id);
  writeSave();
  showGear();
}

// Readable stat line, e.g. "+15% skill damage"
function describeStat(item) {
  const label = slotById(item.slot).label;
  return item.stat === "damage" ? "+" + item.value + "% " + label : "+" + item.value + " " + label;
}

// ---------------------------------------------------------------
// The gear screen
// ---------------------------------------------------------------

// The character on the Gear screen, wearing their armor (like Minecraft's
// inventory). render.js calls this every frame so it animates.
function drawPaperDoll() {
  const doll = document.getElementById("doll-canvas");
  const dollCtx = doll.getContext("2d");
  dollCtx.clearRect(0, 0, doll.width, doll.height);
  const playerClass = currentClass();
  if (playerClass === undefined) {
    return;
  }
  const body = getImage(classSpritePath(playerClass.id));
  const frame = idleFrame(animationTime);
  if (body === null) {
    dollCtx.fillStyle = playerClass.color;  // fallback while the image loads
    dollCtx.fillRect(4, 4, 8, 12);
    return;
  }
  drawFrame(body, frame, 0, 0, SPRITE_SIZE, false, dollCtx);
  const armor = armorSheet(false);
  if (armor !== null) {
    drawFrame(armor, frame, 0, 0, SPRITE_SIZE, false, dollCtx);
  }
}

// The Tool, Armor and Module slots beside the character
function showEquipSlots() {
  const slots = document.getElementById("doll-slots");
  slots.innerHTML = "";
  lootTable.slots.forEach(slot => {
    const item = findItem(save.equipped[slot.id]) || null;
    const row = document.createElement("div");
    row.className = "doll-slot";
    row.appendChild(makeIconCanvas(item, 48));

    const text = document.createElement("div");
    const label = document.createElement("strong");
    label.textContent = slot.name;
    text.appendChild(label);
    const detail = document.createElement("small");
    if (item === null) {
      detail.textContent = "Empty";
    } else {
      detail.textContent = item.name + " · " + describeStat(item) +
        (item.level > save.level ? " · inactive until level " + item.level : "");
      detail.style.color = tierById(item.tier).color;
    }
    text.appendChild(detail);
    row.appendChild(text);
    slots.appendChild(row);
  });
}

function showGear() {
  showPanel("gear-panel");
  floatingTexts = [];  // the last fight's damage numbers don't belong on the Gear screen
  speech = null;
  showEquipSlots();

  document.getElementById("gear-summary").textContent =
    "Gear bonuses: +" + gearBonus("damage") + "% skill damage, +" + gearBonus("hp") +
    " max health, +" + gearBonus("time") + " seconds per question" +
    "  (bag: " + save.inventory.length + "/" + lootTable.inventoryLimit + ")";

  const list = document.getElementById("gear-list");
  list.innerHTML = "";

  if (save.inventory.length === 0) {
    list.textContent = "No gear yet. Defeat enemies to find some. Bosses always drop something.";
    return;
  }

  // Best first: equipped items, then by tier, then by level
  const sorted = [...save.inventory].sort((a, b) =>
    (isEquipped(b) - isEquipped(a)) || (tierRank(b.tier) - tierRank(a.tier)) || (b.level - a.level));

  sorted.forEach(item => {
    const row = document.createElement("div");
    row.className = "gear-item";
    row.appendChild(makeIconCanvas(item, 40));
    const info = document.createElement("div");
    row.appendChild(info);

    const name = document.createElement("strong");
    name.textContent = item.name + (isEquipped(item) ? " [equipped]" : "");
    name.style.color = tierById(item.tier).color;
    info.appendChild(name);

    const details = document.createElement("small");
    let text = slotById(item.slot).name + " · " + describeStat(item) + " · Requires level " + item.level;
    if (item.effectText) {
      text += " · " + item.effectText;
    }
    if (item.level > save.level) {
      text += " · (your level is too low)";
    }
    details.textContent = text;
    info.appendChild(details);

    const equipButton = document.createElement("button");
    if (isEquipped(item)) {
      equipButton.textContent = "Unequip";
      equipButton.addEventListener("click", () => unequip(item));
    } else {
      equipButton.textContent = "Equip";
      equipButton.disabled = item.level > save.level;
      equipButton.addEventListener("click", () => equip(item));
    }
    info.appendChild(equipButton);

    const discardButton = document.createElement("button");
    discardButton.textContent = "Discard";
    discardButton.addEventListener("click", () => discard(item));
    info.appendChild(discardButton);

    list.appendChild(row);
  });
}

// Arrow functions: map.js loads after this file (see the note in classes.js)
document.getElementById("gear-button").addEventListener("click", () => showGear());
document.getElementById("gear-back-button").addEventListener("click", () => showMap());
