// Screens and the map: switching panels, sub-zones and unlocking.

// ===============================================================
// Screens: only one panel shows at a time
// ===============================================================

function showPanel(id) {
  ["mode-panel", "class-panel", "map-panel", "battle-panel"].forEach(panelId => {
    document.getElementById(panelId).hidden = panelId !== id;
  });
}

// ===============================================================
// The map: sub-zones and unlocking
// ===============================================================

// A zone is unlocked if it's the first one, or the one before it is cleared
function isUnlocked(index) {
  return index === 0 || save.clearedZones.includes(zones[index - 1].id);
}

function showMap() {
  stopTimer();
  currentZone = null;
  enemy.maxHp = 0;
  showPanel("map-panel");

  document.getElementById("player-summary").textContent =
    currentClass().name + " · Level " + save.level + " · XP " + save.xp + "/" + xpToNextLevel() + " · Mode: " + currentMode.label;

  const list = document.getElementById("zone-list");
  list.innerHTML = "";

  zones.forEach((zone, index) => {
    const button = document.createElement("button");
    let status = "";

    if (!isUnlocked(index)) {
      status = "[locked]";
      button.disabled = true;
    } else if (zone.enemies.length === 0) {
      status = "[coming soon]";
      button.disabled = true;
    } else if (save.clearedZones.includes(zone.id)) {
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
  if (confirm("Reset your class, level, XP and cleared zones?")) {
    save = newSave();
    writeSave();
    showClassPicker();  // a fresh start means picking a class again
  }
});
