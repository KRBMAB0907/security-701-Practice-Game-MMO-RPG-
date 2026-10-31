// Gear affixes and set items (like Path of Exile 2 and Diablo).
//
// Affixes: Uncommon, Rare and Epic gear rolls 1, 2 or 3 random affixes
// when it's made (data/loot.json "affixCount"). Each one is named after a
// real security concept, e.g. "Salted" (+damage) or "of Reconnaissance"
// (critical hits). The item's name shows one prefix and one suffix:
// "Rare Salted Port Scanner of Reconnaissance". The rolled numbers are
// stored on the item, e.g. item.affixes = [{ id: "salted", stats: { damage: 5 } }].
//
// Set items: 6 sets of 3 pieces (Tool, Armor, Module). Pieces are Epic gear
// with fixed names; wearing 2 or 3 pieces of a set turns on its bonuses.
// Each set drops in its own area (the PKI set from any area's finale boss).
//
// Affixes and set bonuses use the same stat names as the skill tree and
// ascension (see the list at the top of js/ascension.js), so combat already
// knows what to do with them. specialBonus() below adds them all up.

// ---------------------------------------------------------------
// Looking things up
// ---------------------------------------------------------------

function affixById(id) {
  return lootTable.affixes.find(affix => affix.id === id);
}

function setById(id) {
  return lootTable.sets.find(set => set.id === id);
}

// An item's affixes. Items made before affixes existed have none.
function itemAffixes(item) {
  return item.affixes || [];
}

// Set pieces are drawn in the set color; everything else in its tier's color
function itemColor(item) {
  return item.set ? lootTable.setColor : tierById(item.tier).color;
}

// ---------------------------------------------------------------
// Rolling affixes
// ---------------------------------------------------------------

// A random number between range[0] and range[1]. Whole numbers stay whole;
// decimals like [0.1, 0.2] are rounded to 2 places.
function rollAffixValue(range) {
  const [low, high] = range;
  const roll = low + Math.random() * (high - low);
  if (Number.isInteger(low) && Number.isInteger(high)) {
    return Math.round(roll);
  }
  return Math.round(roll * 100) / 100;
}

// Affixes this item could still get: not ones it already has, and not
// ones that need a higher tier (risky affixes need Rare or better)
function affixPool(item) {
  return lootTable.affixes.filter(affix =>
    !itemAffixes(item).some(owned => owned.id === affix.id) &&
    (!affix.minTier || tierRank(item.tier) >= tierRank(affix.minTier)));
}

// Give an item as many affixes as its tier allows. Affixes it already has
// stay, so an upgraded item keeps its old ones and gains a new one.
function addAffixes(item) {
  const wanted = lootTable.affixCount[item.tier] || 0;
  item.affixes = [...itemAffixes(item)];
  while (item.affixes.length < wanted && affixPool(item).length > 0) {
    const affix = randomFrom(affixPool(item));
    const stats = {};
    Object.keys(affix.stats).forEach(stat => {
      stats[stat] = rollAffixValue(affix.stats[stat]);
    });
    item.affixes.push({ id: affix.id, stats: stats });
  }
}

// e.g. "Rare Salted Port Scanner of Reconnaissance". Only the first prefix
// and first suffix go in the name; the gear screen lists all of them.
function affixedName(item, baseName) {
  const prefix = itemAffixes(item).find(owned => affixById(owned.id).kind === "prefix");
  const suffix = itemAffixes(item).find(owned => affixById(owned.id).kind === "suffix");
  const parts = [];
  if (item.tier !== "legendary") {
    parts.push(tierById(item.tier).name);
  }
  if (prefix) {
    parts.push(affixById(prefix.id).name);
  }
  parts.push(baseName);
  if (suffix) {
    parts.push(affixById(suffix.id).name);
  }
  return parts.join(" ");
}

// e.g. "Salted: +5% skill damage". Downsides are stored as negative
// numbers (enemies hit -5% less often), so the text shows them without
// the minus: "enemies hit 5% more often".
function describeAffix(owned) {
  const affix = affixById(owned.id);
  const values = {};
  Object.keys(owned.stats).forEach(stat => {
    values[stat] = Math.abs(owned.stats[stat]);
  });
  return affix.name + ": " + fillLine(affix.text, values);
}

// ---------------------------------------------------------------
// Set items
// ---------------------------------------------------------------

// Is the current fight against an area's finale boss? (the PKI set drops there)
function isFinaleBoss() {
  const area = areaOf(currentZone);
  const lastZone = area.zones[area.zones.length - 1];
  return enemy.boss && currentZone === lastZone && enemyIndex === currentZone.enemies.length - 1;
}

// After a drop is earned: maybe it's a set piece instead. Returns a set or null.
function rollSetDrop() {
  const areaId = areaOf(currentZone).id;
  const candidates = lootTable.sets.filter(set =>
    set.area === areaId || (set.area === "finale" && isFinaleBoss()));
  const chance = enemy.boss ? lootTable.setBossDropChance : lootTable.setDropChance;
  if (candidates.length === 0 || Math.random() >= chance) {
    return null;
  }
  return randomFrom(candidates);
}

// A random piece of a set, as Epic gear at the zone's level (+2 like Epic drops)
function makeSetItem(set, zoneLevel) {
  const piece = randomFrom(set.pieces);
  const tier = tierById("epic");
  return buildItem({ ...piece, set: set.id }, tier, zoneLevel + tier.levelOffset);
}

// How many pieces of a set you're wearing (gear above your level doesn't count)
function setPiecesWorn(setId) {
  return activeGear().filter(item => item.set === setId).length;
}

// Every set bonus that's turned on right now
function activeSetBonuses() {
  const active = [];
  lootTable.sets.forEach(set => {
    set.bonuses.forEach(bonus => {
      if (setPiecesWorn(set.id) >= bonus.pieces) {
        active.push(bonus);
      }
    });
  });
  return active;
}

// ---------------------------------------------------------------
// Adding it all up
// ---------------------------------------------------------------

// One stat from the affixes on your active gear plus your set bonuses
function gearAffixBonus(stat) {
  let total = 0;
  activeGear().forEach(item => {
    itemAffixes(item).forEach(owned => {
      total += owned.stats[stat] || 0;
    });
  });
  activeSetBonuses().forEach(bonus => {
    total += bonus.stats[stat] || 0;
  });
  return total;
}

// Ascension nodes, gear affixes and set bonuses all use the same special
// stats, so combat asks for them together, e.g. specialBonus("critChance")
function specialBonus(stat) {
  return ascensionBonus(stat) + gearAffixBonus(stat);
}

// ---------------------------------------------------------------
// Showing affixes and sets on the Gear and camp screens
// ---------------------------------------------------------------

// Short text for the loot message, e.g. "Salted: +5% skill damage · Set: CIA Triad"
function describeExtras(item) {
  const parts = itemAffixes(item).map(owned => describeAffix(owned));
  if (item.set) {
    parts.push("Set: " + setById(item.set).name + " (" + setPiecesWorn(item.set) + "/3 worn)");
  }
  return parts.join(" · ");
}

// One small line, with an optional concept in italics after it
function extraLine(parent, text, concept, className) {
  const line = document.createElement("small");
  line.className = className;
  line.textContent = text;
  if (concept) {
    const definition = document.createElement("em");
    definition.textContent = " · " + concept;
    line.appendChild(definition);
  }
  parent.appendChild(line);
}

// Under an item on the Gear and camp screens: each affix with what its
// name means, and for set pieces, the set's bonuses (lit up when active)
function appendGearExtras(parent, item) {
  itemAffixes(item).forEach(owned => {
    const affix = affixById(owned.id);
    extraLine(parent, describeAffix(owned), affix.concept, affix.risky ? "affix risky" : "affix");
  });
  if (item.set) {
    const set = setById(item.set);
    const worn = setPiecesWorn(set.id);
    extraLine(parent, "Set: " + set.name + " (" + worn + "/" + set.pieces.length + " worn)", set.concept, "set-line");
    set.bonuses.forEach(bonus => {
      extraLine(parent, bonus.pieces + " pieces: " + bonus.text, null, worn >= bonus.pieces ? "set-bonus active" : "set-bonus");
    });
  }
}
