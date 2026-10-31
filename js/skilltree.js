// The skill tree: five branches, one per exam domain, like Diablo 4's
// tiers with Path of Exile 2-style keystones. The nodes live in
// data/skilltree.json; the keystone numbers are in js/config.js.
//
// save.tree remembers how many points are in each node, e.g.
// { "confidentiality": 2, "zero-trust": 1 }. Points are never stored:
// they're worked out from your level (and the final boss), so losing
// levels also takes points away.

// ---------------------------------------------------------------
// Points
// ---------------------------------------------------------------

function findNode(nodeId) {
  return treeNodes.find(node => node.id === nodeId);
}

// 1 point per level after 1, plus a bonus for beating the final boss
function treePointsEarned() {
  const lastArea = areas[areas.length - 1];
  const finalBossBeaten = lastArea !== undefined && isAreaComplete(lastArea);
  return (save.level - 1) + (finalBossBeaten ? FINAL_BOSS_TREE_POINTS : 0);
}

// Points placed in a tree (the saved one, or the plan on the tree screen)
function treePointsSpent(tree) {
  return Object.values(tree).reduce((sum, rank) => sum + rank, 0);
}

function treePointsLeft(tree) {
  return Math.max(treePointsEarned() - treePointsSpent(tree), 0);
}

// ---------------------------------------------------------------
// Bonuses: combat.js, leveling.js, loot.js and timer.js ask for these
// ---------------------------------------------------------------

// Total of one stat from every node you've put points in, e.g.
// treeBonus("hp") with 2 points in Integrity (+6 each) = 12
function treeBonus(stat) {
  let total = 0;
  Object.entries(save.tree).forEach(([nodeId, rank]) => {
    const node = findNode(nodeId);
    if (node !== undefined && node.stats[stat] !== undefined) {
      total += node.stats[stat] * rank;
    }
  });
  return total;
}

// Extra % damage for a skill from its domain's notable (e.g. Governance
// boosts Domain 5 skills). A skill's topics are all in one domain.
function treeDomainDamage(skill) {
  const domain = topicDomains[skill.topics[0]];
  let total = 0;
  Object.entries(save.tree).forEach(([nodeId, rank]) => {
    const node = findNode(nodeId);
    if (node !== undefined && node.domain === domain && node.stats.domainDamage !== undefined) {
      total += node.stats.domainDamage * rank;
    }
  });
  return total;
}

// True if you've taken this keystone, e.g. hasKeystone("zero-trust")
function hasKeystone(keystone) {
  return Object.keys(save.tree).some(nodeId => {
    const node = findNode(nodeId);
    return node !== undefined && node.keystone === keystone;
  });
}

// ---------------------------------------------------------------
// Rules for spending points
// ---------------------------------------------------------------

// A tier opens once enough points are spent anywhere in the tree
function isTierOpen(tier, tree) {
  return treePointsSpent(tree) >= skillTree.tierCosts[tier - 1];
}

function hasAnyKeystone(tree) {
  return Object.keys(tree).some(nodeId => {
    const node = findNode(nodeId);
    return node !== undefined && node.kind === "keystone";
  });
}

// Why a point can't go into this node, or "" if it can
function whyCantAdd(node, tree) {
  const rank = tree[node.id] || 0;
  if (rank >= node.maxRank) {
    return "full";
  }
  if (!isTierOpen(node.tier, tree)) {
    return "spend " + skillTree.tierCosts[node.tier - 1] + " points to open";
  }
  if (node.kind === "keystone" && hasAnyKeystone(tree)) {
    return "only one keystone";
  }
  if (treePointsLeft(tree) === 0) {
    return "no points left";
  }
  return "";
}

// ---------------------------------------------------------------
// The skill tree screen
// Clicks go into a plan first. Nothing is saved until "Lock in", because
// taking points back out costs levels (see resetTree below).
// ---------------------------------------------------------------

let treePlan = {};  // the points on screen, including ones not locked in yet

function hasPlannedPoints() {
  return treePointsSpent(treePlan) > treePointsSpent(save.tree);
}

function showTree() {
  showPanel("tree-panel");
  if (!hasPlannedPoints()) {
    treePlan = { ...save.tree };  // start from what's saved
  }

  const left = treePointsLeft(treePlan);
  const planned = treePointsSpent(treePlan) - treePointsSpent(save.tree);
  document.getElementById("tree-summary").textContent =
    "Points to spend: " + left + " (you get 1 per level, and " + FINAL_BOSS_TREE_POINTS + " more for beating the final boss)" +
    (planned > 0 ? " · " + planned + " planned, not locked in yet" : "");

  const branchesDiv = document.getElementById("tree-branches");
  branchesDiv.innerHTML = "";
  skillTree.branches.forEach(branch => branchesDiv.appendChild(makeBranch(branch)));

  document.getElementById("tree-save-button").disabled = planned === 0;
  document.getElementById("tree-undo-button").disabled = planned === 0;
  const resetButton = document.getElementById("tree-reset-button");
  resetButton.disabled = treePointsSpent(save.tree) === 0;
  resetButton.textContent = "Reset tree (costs " + classSwitchCost() + " levels)";
  updateAscensionEmblem();  // the Ascension circle at the top (js/ascension.js)
}

// One column: the domain's name, then its tiers from top to bottom
function makeBranch(branch) {
  const column = document.createElement("div");
  column.className = "tree-branch";

  const title = document.createElement("h3");
  title.textContent = "Domain " + branch.domain + ": " + branch.name;
  column.appendChild(title);

  for (let tier = 1; tier <= skillTree.tierCosts.length; tier++) {
    const label = document.createElement("p");
    label.className = "tree-tier";
    const cost = skillTree.tierCosts[tier - 1];
    label.textContent = (tier === skillTree.tierCosts.length ? "Keystone" : "Tier " + tier) +
      (cost > 0 ? " · opens at " + cost + " points spent" : "");
    label.classList.toggle("locked", !isTierOpen(tier, treePlan));
    column.appendChild(label);

    branch.nodes
      .filter(node => node.tier === tier)
      .forEach(node => column.appendChild(makeNodeButton(node)));
  }
  return column;
}

function makeNodeButton(node) {
  const button = document.createElement("button");
  const rank = treePlan[node.id] || 0;
  const savedRank = save.tree[node.id] || 0;
  const reason = whyCantAdd(node, treePlan);

  button.className = "tree-node " + node.kind;
  button.dataset.node = node.id;  // lets tests find a node by its id
  button.classList.toggle("taken", rank > 0);
  button.classList.toggle("planned", rank > savedRank);
  button.textContent = node.name + " " + rank + "/" + node.maxRank + (reason !== "" && reason !== "full" ? " [" + reason + "]" : "");

  const effect = document.createElement("small");
  effect.textContent = node.text;
  button.appendChild(effect);
  const concept = document.createElement("small");
  concept.className = "concept";
  concept.textContent = node.concept;
  button.appendChild(concept);

  button.disabled = reason !== "";
  button.addEventListener("click", () => {
    treePlan[node.id] = rank + 1;
    showTree();
  });
  return button;
}

function lockInTree() {
  save.tree = { ...treePlan };
  writeSave();
  showTree();
}

function undoPlannedPoints() {
  treePlan = { ...save.tree };
  showTree();
}

// Taking points back costs levels, the same as switching class
function resetTree() {
  const cost = classSwitchCost();
  const ok = confirm("Reset your skill tree? All points come back, but you lose " + cost + " level(s).");
  if (!ok) {
    return;
  }
  save.level -= cost;
  save.xp = 0;  // start the new level's XP bar fresh, like switching class
  save.tree = {};
  treePlan = {};
  writeSave();
  showTree();
}

function leaveTree() {
  if (hasPlannedPoints() && !confirm("You have points that aren't locked in. Leave without saving them?")) {
    return;
  }
  treePlan = { ...save.tree };
  showMap();
}

// Arrow functions: map.js loads after this file (see the note in classes.js)
document.getElementById("tree-button").addEventListener("click", () => showTree());
document.getElementById("tree-save-button").addEventListener("click", () => lockInTree());
document.getElementById("tree-undo-button").addEventListener("click", () => undoPlannedPoints());
document.getElementById("tree-reset-button").addEventListener("click", () => resetTree());
document.getElementById("tree-back-button").addEventListener("click", () => leaveTree());
