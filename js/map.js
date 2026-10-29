// Screens and the map: switching panels, areas, sub-zones and unlocking.

// ===============================================================
// Screens: only one panel shows at a time
// ===============================================================

function showPanel(id) {
  ["mode-panel", "class-panel", "map-panel", "gear-panel", "tree-panel", "battle-panel"].forEach(panelId => {
    document.getElementById(panelId).hidden = panelId !== id;
  });
  // The skill tree is full screen (like Diablo 4 and Path of Exile 2),
  // so the game screen hides while it's open. See "tree-open" in style.css.
  document.body.classList.toggle("tree-open", id === "tree-panel");
}

// ===============================================================
// Areas and unlocking
// The world has 5 areas (one per exam domain). Each area has sub-zones.
// Everything unlocks in order: clear a zone to open the next one, and
// clear an area's last zone (its finale) to open the next area.
// ===============================================================

function areaOf(zone) {
  return areas.find(area => area.id === zone.area);
}

function isCleared(zone) {
  return save.clearedZones.includes(zone.id);
}

// An area is built once it has zones (areas without a data file have none yet)
function isAreaBuilt(area) {
  return area.zones.length > 0;
}

function isAreaComplete(area) {
  return isAreaBuilt(area) && isCleared(area.zones[area.zones.length - 1]);
}

function isAreaUnlocked(area) {
  const index = areas.indexOf(area);
  return index === 0 || isAreaComplete(areas[index - 1]);
}

function isZoneUnlocked(zone) {
  const area = areaOf(zone);
  const index = area.zones.indexOf(zone);
  return index === 0 ? isAreaUnlocked(area) : isCleared(area.zones[index - 1]);
}

// The furthest area the player can currently play in
function latestPlayableArea() {
  const playable = areas.filter(area => isAreaBuilt(area) && isAreaUnlocked(area));
  return playable[playable.length - 1] || areas[0];
}

// ===============================================================
// The map screen
// ===============================================================

function showMap() {
  stopTimer();
  currentZone = null;
  enemy.maxHp = 0;
  showPanel("map-panel");

  if (selectedArea === null || !isAreaUnlocked(selectedArea)) {
    selectedArea = latestPlayableArea();
  }

  const allMastered = areas.every(area => isAreaComplete(area));
  document.getElementById("player-summary").textContent =
    currentClass().name + " · Level " + save.level + " · XP " + save.xp + "/" + xpToNextLevel() + " · Mode: " + currentMode.label +
    (allMastered ? " · ALL FIVE DOMAINS MASTERED" : "");
  document.getElementById("gear-button").textContent = "Gear (" + save.inventory.length + ")";
  const pointsLeft = treePointsLeft(save.tree);
  document.getElementById("tree-button").textContent = "Skill tree" + (pointsLeft > 0 ? " (" + pointsLeft + " points)" : "");

  showAreaTabs();
  showZoneList();
}

// One button per area along the top of the map
function showAreaTabs() {
  const tabs = document.getElementById("area-list");
  tabs.innerHTML = "";

  areas.forEach(area => {
    const button = document.createElement("button");
    let status = "";
    if (!isAreaBuilt(area)) {
      status = " [coming soon]";
      button.disabled = true;
    } else if (!isAreaUnlocked(area)) {
      status = " [locked]";
      button.disabled = true;
    } else if (isAreaComplete(area)) {
      status = " [complete]";
    }
    button.textContent = area.name + status;
    button.classList.toggle("selected", area === selectedArea);
    button.addEventListener("click", () => {
      selectedArea = area;
      showMap();
    });
    tabs.appendChild(button);
  });
}

// The sub-zones of the selected area
function showZoneList() {
  document.getElementById("area-title").textContent =
    selectedArea.name + " (Domain " + selectedArea.domain + ": " + domainNames[selectedArea.domain] + "): choose a sub-zone";

  const list = document.getElementById("zone-list");
  list.innerHTML = "";

  selectedArea.zones.forEach(zone => {
    const button = document.createElement("button");
    let status = "";

    if (!isZoneUnlocked(zone)) {
      status = "[locked]";
      button.disabled = true;
    } else if (isCleared(zone)) {
      status = "[cleared - replay]";
    }

    button.textContent = zone.name + " (objective " + zone.objective + ") " + status;
    button.addEventListener("click", () => enterZone(zone));
    list.appendChild(button);
  });
}

function enterZone(zone) {
  currentZone = zone;
  enemyIndex = 0;
  showPanel("battle-panel");
  startFight();
}

document.getElementById("change-mode-button").addEventListener("click", () => {
  showPanel("mode-panel");
});

document.getElementById("reset-button").addEventListener("click", () => {
  if (confirm("Reset your class, level, XP, gear, skill tree and cleared zones?")) {
    save = newSave();
    writeSave();
    selectedArea = null;
    showClassPicker();  // a fresh start means picking a class again
  }
});
