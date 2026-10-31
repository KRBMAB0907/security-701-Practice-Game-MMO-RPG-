// Ascension: like Path of Exile 2's ascendancies. Each class chooses one
// of two ascendancies, and each ascendancy has a small round board of 8
// nodes. Points come only from area finale bosses (1 each, 5 in total),
// and resetting is free. The boards live in data/ascension.json.
//
// save.ascendancy is the chosen ascendancy's id (or null), and
// save.ascension remembers taken nodes, e.g. { "salting": 1 }.
//
// Node stats work like the skill tree's (damage, hp, heal...) plus these
// special ones, which combat.js uses:
//   blockHits         the first N enemy hits in a fight are blocked
//   maxHitPercent     no hit can take more than this % of your max health
//   counterOnMiss     when an enemy misses, hit back for this % of your last hit
//   cheatDeath        once per fight, a killing blow leaves you at 1 health
//   streakHeal        every few right answers in a row heal this % of max health
//   lowHpDefense      % less damage taken while below half health
//   dodgeAfterCorrect % less enemy hit chance right after a right answer
//   streakDamage      % more damage per right answer in a row (capped)
//   bossDamage        % more damage to bosses
//   bossDefense       % less damage from bosses
//   healOnWrong       health healed by a wrong answer
//   weakHealPercent   weak-point hits heal this % of max health
//   missDamage        wrong answers still deal this % of the skill's damage
//   critChance        % chance of a critical hit
//   critMultiplier    added to the critical hit multiplier (2x normally)
//   critEveryN        every Nth right answer in a fight is a critical hit
//   firstHitBonus     % more damage on your first hit in a fight
//   thorns            enemies that hit you take this % of the damage back
//   enemyMissHeal     heal this % of max health when an enemy misses
//   defenseAfterWrong % less damage taken right after a wrong answer
//   eliminate         cross out one wrong answer on every question
//   emergencyHeal     once per fight, a big heal when your health gets low
//   dodgePerHit       each of your hits lowers enemy hit chance by this % (capped)
//   lifesteal         heal this % of the damage you deal
//   wildcard          % chance any hit counts as a weak-point hit
//   hpPercent         % more (or less) max health

// ---------------------------------------------------------------
// Points and the chosen ascendancy
// ---------------------------------------------------------------

// 1 point for each area whose finale boss you've beaten
function ascensionPointsEarned() {
  return areas.filter(area => isAreaComplete(area)).length;
}

function ascensionPointsSpent() {
  return Object.keys(save.ascension).length;  // every node takes exactly 1 point
}

function ascensionPointsLeft() {
  return Math.max(ascensionPointsEarned() - ascensionPointsSpent(), 0);
}

// The two ascendancies your class can choose from
function classAscendancies() {
  const entry = ascensionData.classes.find(c => c.classId === save.classId);
  return entry === undefined ? [] : entry.ascendancies;
}

// The ascendancy you chose, or undefined
function currentAscendancy() {
  return classAscendancies().find(a => a.id === save.ascendancy);
}

// Total of one stat from the ascension nodes you've taken (0 if none)
function ascensionBonus(stat) {
  const ascendancy = currentAscendancy();
  if (ascendancy === undefined) {
    return 0;
  }
  let total = 0;
  ascendancy.nodes.forEach(node => {
    if (save.ascension[node.id] && node.stats[stat] !== undefined) {
      total += node.stats[stat];
    }
  });
  return total;
}

// Start-of-fight values for the ascension effects that count things up
// during a fight (streaks, blocks, once-per-fight saves). combat.js calls
// this from startFight.
function resetAscensionFight() {
  ascFight = {
    blocksLeft: ascensionBonus("blockHits"),
    cheatDeathUsed: false,
    emergencyHealUsed: false,
    streak: 0,          // right answers in a row
    rightAnswers: 0,    // right answers this fight, for critEveryN
    firstHitDone: false,
    lastHit: 0,         // your last hit's damage, for counterOnMiss
    revokeStacks: 0,    // % hit chance taken off the enemy by dodgePerHit
    lastAnswer: null    // "right", "wrong" or null before the first answer
  };
}

// ---------------------------------------------------------------
// Rules for taking nodes
// ---------------------------------------------------------------

function isAscensionTierOpen(tier) {
  return ascensionPointsSpent() >= ascensionData.tierCosts[tier - 1];
}

function hasCapstone() {
  return currentAscendancy().nodes.some(node => node.tier === 3 && save.ascension[node.id]);
}

// Why this node can't be taken, or "" if it can
function whyCantTakeAscension(node) {
  if (save.ascension[node.id]) {
    return "taken";
  }
  if (!isAscensionTierOpen(node.tier)) {
    return "spend " + ascensionData.tierCosts[node.tier - 1] + " points to open";
  }
  if (node.tier === 3 && hasCapstone()) {
    return "only one capstone";
  }
  if (ascensionPointsLeft() === 0) {
    return "no Ascension points left";
  }
  return "";
}

// ---------------------------------------------------------------
// The emblem on the skill tree screen: a circle that opens the board
// ---------------------------------------------------------------

function updateAscensionEmblem() {
  const button = document.getElementById("ascension-button");
  const note = document.getElementById("ascension-note");
  const earned = ascensionPointsEarned();
  const ascendancy = currentAscendancy();

  button.disabled = earned === 0;
  button.classList.toggle("locked", earned === 0);
  if (earned === 0) {
    button.innerHTML = "ASCENSION<small>Locked</small>";
    note.textContent = "Locked: need an Ascension point to unlock. Beat an area's finale boss to earn one.";
    return;
  }
  button.innerHTML = "ASCENSION<small>" + (ascendancy === undefined ? "Choose" : ascendancy.name) + "</small>";
  const left = ascensionPointsLeft();
  note.textContent = left > 0
    ? left + " Ascension point" + (left === 1 ? "" : "s") + " to spend."
    : "Unlocked. Beat more finale bosses for more points (" + earned + " of 5).";
}

// ---------------------------------------------------------------
// The ascension screen
// ---------------------------------------------------------------

let selectedAscensionNode = null;  // the node whose details are shown

// Where each node sits in the circle: tier 1 on the inner ring, tier 2 on
// the middle ring, capstones at the top of the outer ring. Angles are in
// degrees, 0 = right and 90 = down (screen y grows downward).
const ASCENSION_RINGS = {
  1: { radius: 20, angles: [210, 330, 90] },
  2: { radius: 31, angles: [270, 30, 150] },
  3: { radius: 39, angles: [240, 300] }
};

function showAscension() {
  showPanel("ascension-panel");
  const ascendancy = currentAscendancy();
  const left = ascensionPointsLeft();

  document.getElementById("ascension-summary").textContent =
    "Ascension points to spend: " + left + " (1 for each area finale boss, " + ascensionPointsEarned() + " of 5 earned)";

  // Nothing to reset until you've chosen an ascendancy
  document.getElementById("ascension-reset-button").disabled = ascendancy === undefined;

  const choices = document.getElementById("ascension-choices");
  const circle = document.getElementById("ascension-circle");
  const info = document.getElementById("ascension-info");
  choices.innerHTML = "";
  circle.innerHTML = "";
  info.innerHTML = "";

  if (ascendancy === undefined) {
    showAscendancyChoices(choices);
    circle.hidden = true;
    info.hidden = true;
    return;
  }
  circle.hidden = false;
  info.hidden = false;
  drawAscensionCircle(circle, ascendancy);
  showAscensionInfo(info);
}

// Before choosing: one button per ascendancy
function showAscendancyChoices(container) {
  const intro = document.createElement("p");
  intro.textContent = "Choose your ascendancy. You can reset for free later and pick the other one.";
  container.appendChild(intro);

  classAscendancies().forEach(ascendancy => {
    const button = document.createElement("button");
    button.className = "ascendancy-choice";
    button.textContent = ascendancy.name;
    const details = document.createElement("small");
    details.textContent = ascendancy.description;
    button.appendChild(details);
    const nodeList = document.createElement("small");
    nodeList.className = "concept";
    nodeList.textContent = "Nodes: " + ascendancy.nodes.map(node => node.name).join(", ");
    button.appendChild(nodeList);
    button.addEventListener("click", () => chooseAscendancy(ascendancy));
    container.appendChild(button);
  });
}

function drawAscensionCircle(circle, ascendancy) {
  // Faint guide rings, one per tier
  Object.values(ASCENSION_RINGS).forEach(ring => {
    const guide = document.createElement("div");
    guide.className = "ascension-ring";
    guide.style.width = guide.style.height = (ring.radius * 2) + "%";
    circle.appendChild(guide);
  });

  const center = document.createElement("div");
  center.className = "ascension-center";
  center.textContent = ascendancy.name;
  circle.appendChild(center);

  [1, 2, 3].forEach(tier => {
    const ring = ASCENSION_RINGS[tier];
    ascendancy.nodes
      .filter(node => node.tier === tier)
      .forEach((node, i) => {
        // Turn the angle into a spot inside the circle, in percent
        const angle = ring.angles[i] * Math.PI / 180;
        const x = 50 + ring.radius * Math.cos(angle);
        const y = 50 + ring.radius * Math.sin(angle);
        circle.appendChild(makeAscensionNode(node, x, y));
      });
  });
}

function makeAscensionNode(node, x, y) {
  const button = document.createElement("button");
  const reason = whyCantTakeAscension(node);
  button.className = "ascension-node";
  button.dataset.node = node.id;  // lets tests find a node by its id
  button.classList.toggle("capstone", node.tier === 3);
  button.classList.toggle("taken", reason === "taken");
  button.classList.toggle("available", reason === "");
  button.classList.toggle("selected", node === selectedAscensionNode);
  button.style.left = x + "%";
  button.style.top = y + "%";
  button.textContent = node.name;
  // Clicking only shows the details; the "Take" button below spends the point,
  // so phone players can read a node before choosing it
  button.addEventListener("click", () => {
    selectedAscensionNode = node;
    showAscension();
  });
  return button;
}

// Details of the selected node, under the circle
function showAscensionInfo(info) {
  const node = selectedAscensionNode;
  if (node === null || !currentAscendancy().nodes.includes(node)) {
    info.textContent = "Tap a node to see what it does. Tier 2 opens at " + ascensionData.tierCosts[1] +
      " points spent, and the capstones at the top at " + ascensionData.tierCosts[2] + " (only one capstone).";
    return;
  }
  const title = document.createElement("strong");
  title.textContent = node.name + (node.tier === 3 ? " (capstone)" : " (tier " + node.tier + ")");
  info.appendChild(title);
  const effect = document.createElement("small");
  effect.textContent = node.text;
  info.appendChild(effect);
  const concept = document.createElement("small");
  concept.className = "concept";
  concept.textContent = node.concept;
  info.appendChild(concept);

  const reason = whyCantTakeAscension(node);
  const button = document.createElement("button");
  button.id = "ascension-take-button";
  button.textContent = reason === "" ? "Take this node (1 point)" : (reason === "taken" ? "Taken" : "Can't take: " + reason);
  button.disabled = reason !== "";
  button.addEventListener("click", () => takeAscensionNode(node));
  info.appendChild(button);
}

function chooseAscendancy(ascendancy) {
  save.ascendancy = ascendancy.id;
  save.ascension = {};
  selectedAscensionNode = null;
  writeSave();
  showAscension();
}

function takeAscensionNode(node) {
  if (whyCantTakeAscension(node) !== "") {
    return;  // the button is disabled too, but never trust the button alone
  }
  save.ascension[node.id] = 1;
  writeSave();
  showAscension();
}

// Free: all points come back and you can choose either ascendancy again
function resetAscension() {
  if (!confirm("Reset your ascension? It's free: your points come back and you can choose either ascendancy again.")) {
    return;
  }
  save.ascendancy = null;
  save.ascension = {};
  selectedAscensionNode = null;
  writeSave();
  showAscension();
}

// Arrow functions: map.js and skilltree.js's screens are set up at runtime
document.getElementById("ascension-button").addEventListener("click", () => showAscension());
document.getElementById("ascension-reset-button").addEventListener("click", () => resetAscension());
document.getElementById("ascension-back-button").addEventListener("click", () => showTree());
