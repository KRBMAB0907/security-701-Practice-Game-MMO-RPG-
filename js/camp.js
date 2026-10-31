// The home camp: the Blacksmith smelts gear into scrap, the Crafter
// turns scrap into gear, and Su Root trains you (his menu and drills are
// in js/mastery.js). Scrap names and every cost live in data/camp.json.
//
// A cost is written as { tier: amount }, e.g. { "rare": 6 } means
// 6 Rare Scrap, and { "legendary": 2, "epic": 4 } means 2 Legendary Cores
// plus 4 Epic Scrap. save.materials holds how much of each the player has.

let campTab = "blacksmith";  // which camp person's menu is open

// ---------------------------------------------------------------
// Scrap: counting, paying and describing costs
// ---------------------------------------------------------------

function materialCount(tierId) {
  return save.materials[tierId] || 0;
}

function canAfford(cost) {
  return Object.keys(cost).every(tierId => materialCount(tierId) >= cost[tierId]);
}

function pay(cost) {
  Object.keys(cost).forEach(tierId => {
    save.materials[tierId] = materialCount(tierId) - cost[tierId];
  });
}

// e.g. "6 Rare Scrap" or "2 Legendary Core + 4 Epic Scrap"
function describeCost(cost) {
  return Object.keys(cost)
    .map(tierId => cost[tierId] + " " + campData.materials[tierId])
    .join(" + ");
}

// Everything the player owns, e.g. "Common Scrap 4 · Rare Scrap 2 · ..."
function describeMaterials() {
  return lootTable.tiers
    .map(tier => campData.materials[tier.id] + " " + materialCount(tier.id))
    .join(" · ");
}

function bagIsFull() {
  return save.inventory.length >= lootTable.inventoryLimit;
}

// The item type an item was made from (e.g. Port Scanner), found by its icon
function itemBase(item) {
  return [...lootTable.bases, ...lootTable.legendaries].find(base => base.icon === itemIcon(item));
}

// The tier one step above, or null for Epic and Legendary (legendaries
// are named items with effects, so nothing upgrades into them)
function nextTier(tierId) {
  const next = lootTable.tiers[tierRank(tierId) + 1];
  return next && campData.upgradeCost[next.id] ? next : null;
}

// ---------------------------------------------------------------
// What the Blacksmith and Crafter do
// ---------------------------------------------------------------

function smelt(item) {
  const amount = campData.smeltYield[item.tier];
  // Ask before melting anything Rare or better: it can't be undone
  if (tierRank(item.tier) >= tierRank("rare") &&
      !confirm("Smelt " + item.name + " into " + amount + " " + campData.materials[item.tier] + "? This can't be undone.")) {
    return;
  }
  save.inventory = save.inventory.filter(other => other.id !== item.id);
  save.materials[item.tier] = materialCount(item.tier) + amount;
  writeSave();
  showCamp("Smelted " + item.name + " into " + amount + " " + campData.materials[item.tier] + ".");
}

// A brand-new item of the chosen type and tier, at the player's level
// so it can be worn right away
function forge(base, tier) {
  const cost = campData.forgeCost[tier.id];
  if (bagIsFull() || !canAfford(cost)) {
    return;  // the button is disabled too, but never trust the button alone
  }
  pay(cost);
  const item = buildItem(base, tier, save.level);
  save.inventory.push(item);
  writeSave();
  showCamp("Forged " + item.name + " (" + describeStat(item) + ").");
}

function craftLegendary(base) {
  const cost = campData.legendaryCost;
  if (bagIsFull() || !canAfford(cost)) {
    return;
  }
  pay(cost);
  const item = buildItem(base, tierById("legendary"), save.level);
  save.inventory.push(item);
  writeSave();
  showCamp("Crafted " + item.name + "!");
}

// Raise an item one tier, keeping its type and level
function upgrade(item) {
  const tier = nextTier(item.tier);
  const cost = tier ? campData.upgradeCost[tier.id] : null;
  if (tier === null || !canAfford(cost)) {
    return;
  }
  pay(cost);
  const oldName = item.name;
  item.tier = tier.id;
  item.name = tier.name + " " + itemBase(item).name;
  item.value = itemValue(tier, item.stat, item.level);
  writeSave();
  showCamp("Upgraded " + oldName + " to " + item.name + ".");
}

// Bring an old item up to the player's level, so it keeps up
function relevel(item) {
  const cost = campData.relevelCost[item.tier];
  if (item.level >= save.level || !canAfford(cost)) {
    return;
  }
  pay(cost);
  item.level = save.level;
  item.value = itemValue(tierById(item.tier), item.stat, item.level);
  writeSave();
  showCamp(item.name + " is now level " + item.level + " (" + describeStat(item) + ").");
}

// ---------------------------------------------------------------
// The camp screen
// ---------------------------------------------------------------

// message: what just happened (e.g. "Smelted ..."), or nothing
function showCamp(message) {
  showPanel("camp-panel");
  floatingTexts = [];
  speech = null;
  // The game screen draws the player standing in camp (see drawCamp)
  player.spritePath = classSpritePath(currentClass().id);
  player.flash = 0;
  player.shake = 0;

  const npc = campData.npcs.find(person => person.id === campTab);
  document.getElementById("camp-materials").textContent = "Your scrap: " + describeMaterials();
  document.getElementById("camp-greeting").textContent = npc.name + ": \"" + npc.greeting + "\"";
  document.getElementById("camp-message").textContent = message || "";
  document.getElementById("blacksmith-tab").classList.toggle("selected", campTab === "blacksmith");
  document.getElementById("crafter-tab").classList.toggle("selected", campTab === "crafter");
  document.getElementById("trainer-tab").classList.toggle("selected", campTab === "su-root");

  const content = document.getElementById("camp-content");
  content.innerHTML = "";
  if (campTab === "blacksmith") {
    showBlacksmith(content);
  } else if (campTab === "crafter") {
    showCrafter(content);
  } else {
    showTrainer(content);  // in mastery.js
  }
}

// A small button; disabled when `enabled` is false
function campButton(label, enabled, onClick) {
  const button = document.createElement("button");
  button.textContent = label;
  button.disabled = !enabled;
  button.addEventListener("click", onClick);
  return button;
}

// One row with an item's icon, name and details, like the Gear screen.
// Returns the part where buttons go.
function campItemRow(list, item) {
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
  details.textContent = slotById(item.slot).name + " · " + describeStat(item) + " · Level " + item.level;
  info.appendChild(details);

  list.appendChild(row);
  return info;
}

// Same order as the Gear screen: equipped first, then best tier, then level
function sortedInventory() {
  return [...save.inventory].sort((a, b) =>
    (isEquipped(b) - isEquipped(a)) || (tierRank(b.tier) - tierRank(a.tier)) || (b.level - a.level));
}

function addHeading(parent, text) {
  const heading = document.createElement("h3");
  heading.textContent = text;
  parent.appendChild(heading);
}

// Unequipped Common items: the junk "Smelt all Common" clears out
function spareCommons() {
  return save.inventory.filter(item => item.tier === "common" && !isEquipped(item));
}

function smeltAllCommon() {
  const items = spareCommons();
  const amount = items.length * campData.smeltYield.common;
  if (items.length === 0 ||
      !confirm("Smelt " + items.length + " Common items into " + amount + " " + campData.materials.common + "?")) {
    return;
  }
  save.inventory = save.inventory.filter(item => !items.includes(item));
  save.materials.common = materialCount("common") + amount;
  writeSave();
  showCamp("Smelted " + items.length + " Common items into " + amount + " " + campData.materials.common + ".");
}

function showBlacksmith(content) {
  if (save.inventory.length === 0) {
    content.textContent = "Your bag is empty. Defeat enemies to find gear to smelt.";
    return;
  }
  // One click to melt every spare Common item (equipped ones are kept)
  const row = document.createElement("div");
  row.className = "camp-row";
  const commons = spareCommons().length;
  row.appendChild(campButton("Smelt all Common (" + commons + ")", commons > 0, () => smeltAllCommon()));
  content.appendChild(row);

  sortedInventory().forEach(item => {
    const info = campItemRow(content, item);
    const amount = campData.smeltYield[item.tier];
    // Equipped gear can't be smelted by accident: unequip it on the Gear screen first
    const label = isEquipped(item) ? "Equipped (unequip to smelt)" :
      "Smelt: +" + amount + " " + campData.materials[item.tier];
    info.appendChild(campButton(label, !isEquipped(item), () => smelt(item)));
  });
}

function showCrafter(content) {
  // 1. Forge new gear: choose the item type and tier
  addHeading(content, "Forge new gear (at your level, " + save.level + ")");
  const baseSelect = document.createElement("select");
  lootTable.bases.forEach((base, i) => {
    const option = document.createElement("option");
    option.value = i;
    option.textContent = slotById(base.slot).name + ": " + base.name;
    baseSelect.appendChild(option);
  });
  const tierSelect = document.createElement("select");
  Object.keys(campData.forgeCost).forEach(tierId => {
    const option = document.createElement("option");
    option.value = tierId;
    option.textContent = tierById(tierId).name;
    tierSelect.appendChild(option);
  });
  const forgeRow = document.createElement("div");
  forgeRow.className = "camp-row";
  const costText = document.createElement("small");
  const forgeButton = campButton("Forge", false, () =>
    forge(lootTable.bases[baseSelect.value], tierById(tierSelect.value)));
  // Update the cost and the button whenever a choice changes
  const updateForge = () => {
    const cost = campData.forgeCost[tierSelect.value];
    costText.textContent = "Cost: " + describeCost(cost) + (bagIsFull() ? " · your bag is full" : "");
    forgeButton.disabled = bagIsFull() || !canAfford(cost);
  };
  baseSelect.addEventListener("change", updateForge);
  tierSelect.addEventListener("change", updateForge);
  updateForge();
  forgeRow.append(baseSelect, tierSelect, forgeButton, costText);
  content.appendChild(forgeRow);

  // 2. Craft a legendary: one button per legendary
  addHeading(content, "Craft a legendary (cost: " + describeCost(campData.legendaryCost) + ")");
  lootTable.legendaries.forEach(base => {
    const row = document.createElement("div");
    row.className = "camp-row";
    row.appendChild(campButton("Craft " + base.name, !bagIsFull() && canAfford(campData.legendaryCost),
      () => craftLegendary(base)));
    const effect = document.createElement("small");
    effect.textContent = slotById(base.slot).name + " · " + base.effectText;
    row.appendChild(effect);
    content.appendChild(row);
  });

  // 3. Upgrade or re-level gear in the bag
  addHeading(content, "Upgrade or re-level your gear");
  if (save.inventory.length === 0) {
    content.appendChild(document.createTextNode("Your bag is empty."));
    return;
  }
  sortedInventory().forEach(item => {
    const info = campItemRow(content, item);

    const tier = nextTier(item.tier);
    if (tier !== null) {
      const cost = campData.upgradeCost[tier.id];
      info.appendChild(campButton("Upgrade to " + tier.name + " (" + describeCost(cost) + ")",
        canAfford(cost), () => upgrade(item)));
    }

    if (item.level < save.level) {
      const cost = campData.relevelCost[item.tier];
      info.appendChild(campButton("Re-level to " + save.level + " (" + describeCost(cost) + ")",
        canAfford(cost), () => relevel(item)));
    }
  });
}

// ---------------------------------------------------------------
// The camp scene on the game screen (called by draw() in render.js)
// ---------------------------------------------------------------

function npcSpritePath(npcId) {
  return "assets/sprites/npcs/" + npcId + ".png";
}

function drawCamp() {
  drawFighter(player, 16, false);

  const frame = idleFrame(animationTime);
  ctx.font = FONT;
  ctx.textAlign = "center";
  campData.npcs.forEach(npc => {
    const sheet = getImage(npcSpritePath(npc.id));
    if (sheet !== null) {
      drawFrame(sheet, frame, npc.x, player.y, 16, true);  // facing left, toward the player
    }
    const chosen = npc.id === campTab;
    shadowText(npc.name, npc.x + 8, player.y - 6, chosen ? "#ffd166" : "#a8d5c0");
    if (chosen) {
      // A bobbing arrow over whoever's menu is open
      shadowText("v", npc.x + 8, player.y - 16 - frame, "#ffd166");
    }
  });

  // Su Root talks during drills. Drawn last, so it sits on top of the names.
  const talker = campData.npcs.find(npc => npc.id === campTab);
  drawSpeechBubble({ x: talker.x, y: player.y }, 16);
  ctx.textAlign = "center";

  shadowText("Home camp", GAME_W / 2, 14, "#a8d5c0");
}

// Arrow functions: map.js loads after this file (see the note in classes.js)
document.getElementById("camp-button").addEventListener("click", () => showCamp());
document.getElementById("camp-back-button").addEventListener("click", () => showMap());
document.getElementById("blacksmith-tab").addEventListener("click", () => {
  campTab = "blacksmith";
  showCamp();
});
document.getElementById("crafter-tab").addEventListener("click", () => {
  campTab = "crafter";
  showCamp();
});
document.getElementById("trainer-tab").addEventListener("click", () => {
  campTab = "su-root";
  showCamp();
});
